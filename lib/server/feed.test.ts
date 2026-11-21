import { beforeEach, describe, expect, it, vi } from "vitest";
import { customerNames, liveEventKey, standingKey } from "@/lib/domain/cards";
import type { KeyedCard } from "@/lib/domain/types";
import type { LlmProvider, ObjectRequest } from "@/lib/llm";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Example cards in an owner's feed. Starters show as examples until a channel
// is connected and a real event has produced a card; then the pending examples
// step aside and the ones the owner decided stay in the history. A page load
// shows the templates at once and leaves the written starters for later.

const SESSION = "owner-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));
const models = vi.hoisted(() => ({ current: null as LlmProvider | null }));
vi.mock("@/lib/server/business-llm", () => ({ getBusinessLlm: () => models.current, llmFromConnections: () => models.current }));
// `after` runs its task once the response is sent; the test runs the tasks when it chooses.
const later = vi.hoisted(() => ({ tasks: [] as (() => Promise<void>)[] }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (task: () => Promise<void>) => later.tasks.push(task) }));

const { getFeed } = await import("./data");

const shop = hvacShop();
const CUSTOMER = customerNames(shop.id, 1)[0] ?? "";

/** A card a customer's text produced through the connected number. */
const LIVE_CARD: KeyedCard = {
  agent: "frontdesk",
  skill: "inquiry",
  title: "New text from (301) 555-0192",
  body: "Thanks for texting! Reply STOP to opt out.",
  reason: "They wrote: \"Can you look at my AC?\"",
  checks: [],
  action: "Send text",
  channel: "sms",
  to: "(301) 555-0192",
  key: liveEventKey(shop.id, "e1"),
};

async function connectTexting(): Promise<void> {
  await stores.current!.saveConnection(SESSION, { businessId: shop.id, kind: "texting", hookId: "hook-1", settings: {}, secret: null });
}

beforeEach(async () => {
  stores.current = new MemoryStore();
  models.current = null;
  later.tasks = [];
  await stores.current.saveBusiness(SESSION, shop);
});

describe("example cards", () => {
  it("fill an owner's feed while nothing is connected", async () => {
    const { cards, connected } = await getFeed(shop);

    expect(connected).toBe(false);
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) expect(card.example, card.key).toBe(true);
  });

  it("stay after a channel is connected, until a real event produces a card", async () => {
    await connectTexting();

    const { cards, connected } = await getFeed(shop);

    expect(connected).toBe(true);
    expect(cards.some((card) => card.example === true)).toBe(true);
  });

  it("step aside once a connected channel's event produces a card, keeping the ones the owner decided", async () => {
    const decidedKey = standingKey(shop.id, "callback");
    const before = await getFeed(shop);
    const callback = before.cards.find((card) => card.key === decidedKey);
    if (callback === undefined) throw new Error("test setup: the shop has no callback starter");
    await stores.current!.ensureCards(SESSION, shop.id, [callback]);
    const stored = (await stores.current!.listCards(SESSION, shop.id))[0];
    await stores.current!.updateCard(SESSION, stored!.id, { status: "skipped", decidedAt: new Date().toISOString() });
    await connectTexting();
    await stores.current!.ensureCards(SESSION, shop.id, [LIVE_CARD]);

    const { cards } = await getFeed(shop);

    expect(cards.filter((card) => card.status === "pending").map((card) => card.key)).toEqual([LIVE_CARD.key]);
    expect(cards.find((card) => card.key === decidedKey)).toMatchObject({ status: "skipped", example: true });
  });

  it("stay when an event card arrives with no channel connected", async () => {
    await stores.current!.ensureCards(SESSION, shop.id, [LIVE_CARD]);

    const { cards } = await getFeed(shop);

    expect(cards.some((card) => card.example === true && card.status === "pending")).toBe(true);
  });
});

describe("written starters on a page load", () => {
  it("show the templates at once and write the starters after the response", async () => {
    const prompts: string[] = [];
    models.current = {
      generateText: async () => "",
      generateObject: async <T,>(request: ObjectRequest<T>) => {
        prompts.push(request.prompt);
        return request.schema.parse({ starters: [{ skill: "inquiry", contact: CUSTOMER, title: "A tune-up question", body: "Hi there, happy to help with that.", whyNow: "She's comparing shops today." }] });
      },
    } as unknown as LlmProvider;

    const first = await getFeed(shop);

    expect(prompts).toHaveLength(0);
    expect(first.writingStarters).toBe(true);
    expect(first.cards.find((card) => card.skill === "inquiry")?.title).not.toBe("A tune-up question");

    for (const task of later.tasks.splice(0)) await task();
    const next = await getFeed(shop);

    expect(prompts).toHaveLength(1);
    expect(next.writingStarters).toBe(false);
    expect(next.cards.find((card) => card.skill === "inquiry")).toMatchObject({ title: "A tune-up question", to: CUSTOMER, example: true });
    expect(later.tasks).toHaveLength(0);
  });

  it("schedule nothing with AI off", async () => {
    const feed = await getFeed(shop);

    expect(feed.writingStarters).toBe(false);
    expect(later.tasks).toHaveLength(0);
  });
});
