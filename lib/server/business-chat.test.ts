import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { OPT_OUT_LINE } from "@/lib/domain/executor";
import { chatCardKey } from "@/lib/domain/requests";
import type { LlmProvider } from "@/lib/llm";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The example business's chat, as a visitor reads it: the first message says
// what chat does in an owner's own business and that the example can't
// change, and a message sent to it changes and stores nothing. An owner's own
// chat drafts the work they ask for into Approvals, and links the reply to the
// card. The model, when a test sets one, writes only the words.

const SESSION = "visitor-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
const models = vi.hoisted(() => ({ current: null as LlmProvider | null }));
vi.mock("@/lib/server/ai-budget", () => ({ getBudgetedLlm: () => models.current }));

const { listBusinessChat, sendBusinessChat } = await import("./business-chat");

beforeEach(() => {
  stores.current = new MemoryStore();
  models.current = null;
});

/** A model that answers every text request with `reply`. */
function modelSaying(reply: string): LlmProvider {
  return {
    generateText: async () => reply,
    generateObject: async () => {
      throw new Error("This test's model only writes text.");
    },
  } as unknown as LlmProvider;
}

/** A model that reads every chat message as changing only the text fields in `texts`. */
function modelReading(texts: { kind: string | null; name: string | null; place: string | null; voice: string | null }): LlmProvider {
  const none = { reach: [], tools: [], signals: [], languages: [] };
  return {
    generateText: async () => {
      throw new Error("This test's model only reads changes.");
    },
    generateObject: async () => ({ add: none, remove: none, ...texts }),
  } as unknown as LlmProvider;
}

describe("the example business's chat", () => {
  it("opens by saying what chat does for an owner and that the example can't change", async () => {
    const { messages } = await listBusinessChat(SESSION, SAMPLE_BUSINESS);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("tell Anchored what changed");
    expect(messages[0]?.text).toContain("can't change anything");
    expect(messages[0]?.text).toContain("Set up your business");
  });

  it("answers a message without changing or saving anything", async () => {
    const sent = await sendBusinessChat(SESSION, SAMPLE_BUSINESS, "We now take EBT");

    expect(sent.changes).toEqual([]);
    expect(sent.messages.at(-1)?.text).toContain("is an example, so I can't change it");
    expect((await listBusinessChat(SESSION, SAMPLE_BUSINESS)).messages).toHaveLength(1);
  });
});

describe("an owner's own chat", () => {
  const shop = hvacShop();

  it("drafts the work the owner asks for into Approvals and links the reply to the card", async () => {
    const sent = await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const reply = sent.messages.at(-1);
    expect(reply?.text).toContain("drafted a text to Dana");
    const cards = await stores.current!.listCards(SESSION, shop.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ status: "pending", channel: "sms", to: "Dana", key: chatCardKey(shop.id, reply!.id) });
    expect(cards[0]?.body).toBe(`Hi Dana, it's College Park Heating & Air. We're running 20 minutes late. ${OPT_OUT_LINE}`);
    expect(reply?.card).toEqual({ key: cards[0]?.key, title: "Text Dana we're running 20 minutes late", status: "pending" });
  });

  it("keeps the link on the reply after a reload", async () => {
    await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const { messages } = await listBusinessChat(SESSION, shop);

    expect(messages.at(-1)?.card?.status).toBe("pending");
    expect(messages.filter((message) => message.card !== undefined)).toHaveLength(1);
  });

  it("names the workflow to Build when none of the owner's agents does the work, and drafts nothing", async () => {
    await stores.current!.setChoice(SESSION, shop.id, "social", { path: "skip" });

    const sent = await sendBusinessChat(SESSION, shop, "write a post about our new heat pump service");

    expect(sent.messages.at(-1)?.text).toContain(`"Social posts and marketing"`);
    expect(await stores.current!.listCards(SESSION, shop.id)).toEqual([]);
  });

  it("still updates the profile when the owner says what changed", async () => {
    const sent = await sendBusinessChat(SESSION, shop, "We started doing catering");

    expect(sent.changes.length).toBeGreaterThan(0);
    expect(await stores.current!.listCards(SESSION, shop.id)).toEqual([]);
  });

  it("uses the model's words when they add nothing the owner didn't say", async () => {
    models.current = modelSaying("Hi Dana, sorry, we're running 20 minutes late. See you soon!");

    await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const [card] = await stores.current!.listCards(SESSION, shop.id);
    expect(card?.body).toBe(`Hi Dana, sorry, we're running 20 minutes late. See you soon! ${OPT_OUT_LINE}`);
  });

  it("changes nothing when the model reads a change into a question", async () => {
    models.current = modelReading({ kind: "Plumbing", name: null, place: null, voice: null });

    const sent = await sendBusinessChat(SESSION, shop, "What did you send to my customers today?");

    expect(sent.changes).toEqual([]);
    expect(sent.messages.at(-1)?.text).not.toContain("Updated your profile");
  });

  it("keeps a change the owner's own words state", async () => {
    models.current = modelReading({ kind: "Plumbing and heating", name: null, place: null, voice: null });

    const sent = await sendBusinessChat(SESSION, shop, "We do plumbing and heating now");

    expect(sent.changes).toContainEqual(expect.objectContaining({ area: "kind", label: "Plumbing and heating" }));
  });

  it("falls back to the rules when the model adds a price", async () => {
    models.current = modelSaying("Hi Dana, we're running 20 minutes late, so today's visit is $20 off.");

    await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const [card] = await stores.current!.listCards(SESSION, shop.id);
    expect(card?.body).not.toContain("$20");
    expect(card?.body).toContain("We're running 20 minutes late.");
  });
});

describe("the example business's chat, asked for work", () => {
  it("drafts and stores nothing", async () => {
    const sent = await sendBusinessChat(SESSION, SAMPLE_BUSINESS, "write a post about our new Taco Tuesday");

    expect(sent.messages.at(-1)?.card).toBeUndefined();
    expect(await stores.current!.listCards(SESSION, SAMPLE_BUSINESS.id)).toEqual([]);
  });
});

describe("Bookkeeping in an owner's chat", () => {
  const shop = hvacShop();
  const store = () => stores.current!;
  const say = (text: string) => sendBusinessChat(SESSION, shop, text);
  const reminders = async () => (await store().listCards(SESSION, shop.id)).filter((card) => card.skill === "nudger" && card.invoice);

  beforeEach(async () => {
    await store().setChoice(SESSION, shop.id, "books", { path: "build", skills: ["nudger"] });
  });

  it("drafts a reminder from what the owner typed and links the reply to it", async () => {
    await store().saveContact(SESSION, { businessId: shop.id, name: "Maya Chen", phone: null, email: "maya.chen@example.com", consent: null, optedOutAt: null });

    const sent = await say("Maya Chen owes $450 on invoice 1042, due Oct 20");

    const reply = sent.messages.at(-1);
    expect(reply?.text).toBe("Bookkeeping and Invoicing drafted a reminder to Maya Chen for $450 on invoice 1042. It's waiting in Approvals.");
    const [card] = await reminders();
    expect(card).toMatchObject({ key: chatCardKey(shop.id, reply!.id), to: "maya.chen@example.com", stake: 450, invoice: { key: "n:1042" } });
    expect(card?.body).toContain("for $450 was due Oct 20");
    expect(reply?.card).toEqual({ key: card?.key, title: "Maya Chen owes $450 on invoice 1042", status: "pending" });
  });

  it("says how to send it when the customer has no email on file", async () => {
    const sent = await say("Jordan Ellis owes $1,200 on invoice 1043");
    expect(sent.messages.at(-1)?.text).toContain("Add Jordan Ellis's email in Connections so Anchored can send it, or send it yourself.");
    expect((await reminders())[0]).toMatchObject({ to: "Jordan Ellis", stake: 1200 });
  });

  it("asks for a missing amount and drafts nothing", async () => {
    const sent = await say("Jordan still owes me");
    expect(sent.messages.at(-1)?.text).toBe("How much does Jordan owe? I'll only use the amount you give me.");
    expect(await store().listCards(SESSION, shop.id)).toEqual([]);
  });

  it("refuses a third reminder in the owner's words", async () => {
    await say("Maya Chen owes $450 on invoice 1042");
    await say("Maya Chen owes $450 on invoice 1042");
    const sent = await say("Maya Chen owes $450 on invoice 1042");
    expect(sent.messages.at(-1)?.text).toBe("Invoice 1042 already has 2 reminders. Anchored won't send a third. Call the customer if it's still unpaid.");
    expect(await reminders()).toHaveLength(2);
  });

  it("marks an invoice paid and says how many reminders it stopped", async () => {
    await say("Maya Chen owes $450 on invoice 1042");
    const sent = await say("Maya paid 1042");
    expect(sent.messages.at(-1)?.text).toBe("Marked invoice 1042 from Maya paid. I stopped 1 reminder that was waiting.");
    expect((await reminders())[0]?.status).toBe("superseded");
  });

  it("asks which invoice when a customer with two open ones paid", async () => {
    await say("Maya Chen owes $450 on invoice 1042");
    await say("Maya Chen owes $90 on invoice 1046");
    const sent = await say("Maya Chen paid in full");
    expect(sent.messages.at(-1)?.text).toBe("Maya Chen has more than one open invoice: invoice 1042 and invoice 1046. Which one was paid?");
    expect((await reminders()).every((card) => card.status === "pending")).toBe(true);
  });

  it("leaves money the business itself paid to the profile reader", async () => {
    const sent = await say("We paid $300 for new ads last month");
    expect(sent.messages.at(-1)?.text).not.toMatch(/Which invoice|reminder/);
    expect(await store().listCards(SESSION, shop.id)).toEqual([]);
  });

  it("leaves invoice talk to the request reader when Bookkeeping isn't working", async () => {
    await store().setChoice(SESSION, shop.id, "books", { path: "skip" });
    await say("Maya Chen owes $450 on invoice 1042");
    expect(await reminders()).toEqual([]);
  });
});
