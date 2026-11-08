import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Bookkeeping's path through `ingestEvent`, on the in-memory store: an overdue
// invoice becomes a reminder drafted from the invoice's own facts, a third
// reminder for one invoice is refused, a payment stops the reminders still
// waiting and tells the owner how many, a payment named only by a customer
// with two open invoices asks which one, and an approved reminder to a customer
// who opted out stays the owner's to send.

const SESSION = "owner-session";
const SHOP = hvacShop();

const state = vi.hoisted(() => ({ store: null as MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { ingestEvent } = await import("./ingest");
const { decideCard } = await import("./decide");

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

const MAYA = { name: "Maya Chen", email: "maya.chen@example.com", amount: 450, number: "1042", kind: "overdue", due: "Oct 20" };

/** Send one Bookkeeping event the way a webhook or the owner's chat would. */
function send(source: "invoice-late" | "invoice-paid", payload: Record<string, unknown>) {
  return ingestEvent(SESSION, SHOP, source, payload, "live");
}

async function cards() {
  return store().listCards(SESSION, SHOP.id);
}

beforeEach(async () => {
  state.store = new MemoryStore();
  await store().saveBusiness(SESSION, SHOP);
  await store().setChoice(SESSION, SHOP.id, "books", { path: "build", skills: ["nudger"] });
});

describe("overdue invoices", () => {
  it("drafts a reminder from the invoice's own amount, number and due date", async () => {
    expect(await send("invoice-late", MAYA)).toMatchObject({ ok: true });
    const [card] = await cards();
    expect(card).toMatchObject({
      skill: "nudger",
      title: "Maya Chen owes $450 on invoice 1042",
      body: "Hi Maya, a quick reminder that invoice 1042 from College Park Heating & Air for $450 was due Oct 20. Reply here with any questions. Thanks!",
      reason: "The invoice was due Oct 20.",
      channel: "email",
      to: "maya.chen@example.com",
      stake: 450,
      invoice: { key: "n:1042", number: "1042", customer: "maya chen", amount: 450 },
    });
    expect(card?.body).not.toMatch(/late fee/i);
  });

  it("writes amounts with commas and cents", async () => {
    await send("invoice-late", { ...MAYA, amount: 1240.5, number: "2031" });
    expect((await cards())[0]?.title).toBe("Maya Chen owes $1,240.50 on invoice 2031");
  });

  it("allows two reminders per invoice and refuses the third", async () => {
    expect(await send("invoice-late", MAYA)).toMatchObject({ ok: true });
    expect(await send("invoice-late", MAYA)).toMatchObject({ ok: true });
    expect(await send("invoice-late", MAYA)).toEqual({
      ok: false,
      status: 409,
      error: "Invoice 1042 already has 2 reminders. Anchored won't send a third. Call the customer if it's still unpaid.",
    });
    // A second invoice for the same customer has its own count.
    expect(await send("invoice-late", { ...MAYA, number: "1046", amount: 90 })).toMatchObject({ ok: true });
    expect(await cards()).toHaveLength(3);
  });

  it("counts an invoice with no number by the customer's email and amount", async () => {
    const dev = { name: "Dev Rao", email: "dev.rao@example.com", amount: 175, kind: "overdue" };
    await send("invoice-late", dev);
    await send("invoice-late", dev);
    expect(await send("invoice-late", dev)).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses an invoice nothing tells apart from the others", async () => {
    expect(await send("invoice-late", { amount: 50, kind: "overdue" })).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("can't tell this invoice apart") });
    expect(await cards()).toHaveLength(0);
  });
});

describe("payments", () => {
  it("stops the invoice's waiting reminders and tells the owner", async () => {
    await send("invoice-late", MAYA);
    await send("invoice-late", { ...MAYA, number: "1046", amount: 90 });
    expect(await send("invoice-paid", { name: "Maya Chen", number: "1042", amount: 450 })).toMatchObject({ ok: true });

    const byNumber = new Map((await cards()).map((card) => [card.invoice?.number ?? card.channel, card]));
    expect(byNumber.get("1042")?.status).toBe("superseded");
    expect(byNumber.get("1046")?.status).toBe("pending");
    expect(byNumber.get("list")).toMatchObject({
      title: "Maya Chen paid $450 on invoice 1042",
      body: "Invoice 1042 from Maya Chen is marked paid. Anchored stopped 1 reminder that was waiting.",
      channel: "list",
      status: "pending",
    });
    expect(byNumber.get("list")?.to).toBeUndefined();
    // Once paid, a new overdue event for it can draft again only within the cap; the stopped one no longer counts.
    expect(await send("invoice-late", MAYA)).toMatchObject({ ok: true });
  });

  it("stops a reminder the owner approved that is still queued to send", async () => {
    await send("invoice-late", MAYA);
    const [reminder] = await cards();
    if (!reminder) throw new Error("test setup: no reminder");
    await store().addOutbox(SESSION, { businessId: SHOP.id, cardId: reminder.id, channel: "email", to: MAYA.email, body: reminder.body, delivery: "queued" });

    await send("invoice-paid", { number: "INV-1042" });

    const [entry] = await store().listOutbox(SESSION, SHOP.id);
    expect(entry).toMatchObject({ delivery: "failed", note: "Not sent: invoice INV-1042 was paid." });
  });

  it("matches a payment named only by the customer to their one open invoice", async () => {
    await send("invoice-late", { ...MAYA, name: "Sam Lee", email: "sam.lee@example.com", number: "1045", amount: 240 });
    await send("invoice-paid", { name: "Sam Lee" });
    expect((await cards()).find((card) => card.skill === "nudger" && card.invoice)?.status).toBe("superseded");
  });

  it("asks which invoice when the customer has two open", async () => {
    await send("invoice-late", MAYA);
    await send("invoice-late", { ...MAYA, number: "1046", amount: 90 });
    expect(await send("invoice-paid", { name: "Maya Chen" })).toEqual({
      ok: false,
      status: 409,
      error: "Maya Chen has more than one open invoice: invoice 1042 and invoice 1046. Which one was paid?",
    });
    expect((await cards()).every((card) => card.status === "pending")).toBe(true);
  });

  it("says so when no reminders were waiting", async () => {
    await send("invoice-paid", { number: "9999" });
    expect((await cards())[0]?.body).toBe("Invoice 9999 is marked paid. No reminders were waiting.");
  });

  it("refuses a payment that names no invoice or customer", async () => {
    expect(await send("invoice-paid", { amount: 100 })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("delivery", () => {
  it("keeps an approved reminder the owner's to send when Anchored can't send email", async () => {
    await send("invoice-late", { ...MAYA, name: "Alex Romero", email: "alex.romero@example.com", number: "1047", amount: 600 });
    await store().saveContact(SESSION, { businessId: SHOP.id, name: "Alex Romero", phone: null, email: "alex.romero@example.com", consent: null, optedOutAt: "2026-11-01T10:00:00Z" });
    const [reminder] = await cards();
    if (!reminder) throw new Error("test setup: no reminder");

    const result = await decideCard(store(), SESSION, reminder, { decision: "approve" });

    expect(result.ok).toBe(true);
    const outbox = result.ok ? result.response.outbox : undefined;
    expect(outbox).toMatchObject({ channel: "email", to: "alex.romero@example.com", delivery: "yours" });
  });
});
