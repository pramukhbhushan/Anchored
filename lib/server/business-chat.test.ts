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
