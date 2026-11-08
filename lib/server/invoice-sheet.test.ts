import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceAccount } from "@/lib/connectors/google-sheets";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Checking an owner's invoice sheet, with Google replaced by fixed rows: overdue
// rows become reminders, a second check drafts nothing twice, a row marked paid
// stops its reminder once, and an invoice the owner already reminded about in
// chat gets no second reminder from the sheet.

const SESSION = "owner-session";
const SHOP = hvacShop();
const ACCOUNT: ServiceAccount = { clientEmail: "robot@test.iam.gserviceaccount.com", privateKey: "unused" };
// Nov 8, 2026, midday in Maryland.
const NOW = new Date("2026-11-08T17:00:00Z");

const state = vi.hoisted(() => ({ store: null as MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
const { syncInvoiceSheet } = await import("./invoice-sheet");
const { ingestEvent } = await import("./ingest");

const HEADER = ["Invoice #", "Customer", "Email", "Amount", "Due date", "Status"];
let rows: string[][] = [];
const read = async () => rows;
const sync = () => syncInvoiceSheet(SESSION, SHOP, "sheet-1", ACCOUNT, NOW, read);
const reminders = async () => (await state.store!.listCards(SESSION, SHOP.id)).filter((card) => card.skill === "nudger" && card.invoice);

beforeEach(async () => {
  state.store = new MemoryStore();
  await state.store.saveBusiness(SESSION, SHOP);
  await state.store.setChoice(SESSION, SHOP.id, "books", { path: "build", skills: ["nudger"] });
  rows = [
    HEADER,
    ["1042", "Maya Chen", "maya.chen@example.com", "450", "2026-10-20", "Unpaid"],
    ["1044", "Priya Patel", "priya.patel@example.com", "300", "2026-11-20", "Unpaid"],
    ["1045", "Sam Lee", "sam.lee@example.com", "240", "2026-10-15", "Paid"],
  ];
});

describe("syncInvoiceSheet", () => {
  it("drafts a reminder for each overdue unpaid row, from the sheet's own numbers", async () => {
    expect(await sync()).toEqual({ invoices: 3, drafted: 1, stopped: 0, alreadyDrafted: 0, notDue: 1, problems: [], missingColumns: [] });
    const [card] = await reminders();
    expect(card).toMatchObject({ key: `${SHOP.id}:sheet:late:n:1042`, to: "maya.chen@example.com", stake: 450, title: "Maya Chen owes $450 on invoice 1042" });
    expect(card?.body).toContain("was due Oct 20");
  });

  it("drafts nothing twice when the sheet is checked again", async () => {
    await sync();
    expect(await sync()).toMatchObject({ drafted: 0, alreadyDrafted: 1 });
    expect(await reminders()).toHaveLength(1);
  });

  it("stops the reminder once the row is marked paid, and only once", async () => {
    await sync();
    rows = rows.map((row) => (row[0] === "1042" ? [...row.slice(0, 5), "Paid"] : row));

    expect(await sync()).toMatchObject({ stopped: 1, drafted: 0 });
    expect((await reminders())[0]?.status).toBe("superseded");
    const notes = (await state.store!.listCards(SESSION, SHOP.id)).filter((card) => card.channel === "list");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.body).toBe("Invoice 1042 from Maya Chen is marked paid. Anchored stopped 1 reminder that was waiting.");

    await sync();
    expect((await state.store!.listCards(SESSION, SHOP.id)).filter((card) => card.channel === "list")).toHaveLength(1);
  });

  it("leaves an invoice the owner already reminded about in chat alone", async () => {
    await ingestEvent(SESSION, SHOP, "invoice-late", { name: "Maya Chen", amount: 450, number: "1042", kind: "overdue" }, "live");
    expect(await sync()).toMatchObject({ drafted: 0, alreadyDrafted: 1 });
    expect(await reminders()).toHaveLength(1);
  });

  it("ignores paid rows that never had a reminder", async () => {
    expect((await sync()).stopped).toBe(0);
    expect((await state.store!.listCards(SESSION, SHOP.id)).filter((card) => card.channel === "list")).toEqual([]);
  });

  it("reports a header it can't use and drafts nothing", async () => {
    rows = [["Name", "Notes"], ["Maya", "owes money"]];
    expect(await sync()).toMatchObject({ missingColumns: ["Amount", "Status", "Due date"], drafted: 0 });
    expect(await reminders()).toEqual([]);
  });
});
