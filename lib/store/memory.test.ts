import { describe, expect, it } from "vitest";
import type { KeyedCard } from "@/lib/domain/types";
import { MemoryStore } from "./memory";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `MemoryStore` that the server relies on: the pending-only card
// update, the shared daily AI call cap, and the bound on how many sessions it keeps.

const BUSINESS = "b_test";

const card: KeyedCard = {
  key: `${BUSINESS}:callback`,
  agent: "frontdesk",
  skill: "callback",
  title: "Missed call",
  body: "Sorry we missed you. Reply STOP to opt out.",
  reason: "Callers who wait often book the next shop.",
  checks: [],
  action: "Send text",
  channel: "sms",
  to: "(301) 555-0192",
};

describe("updatePendingCard", () => {
  it("updates a pending card and refuses once it is decided", async () => {
    const store = new MemoryStore();
    await store.ensureCards("s1", BUSINESS, [card]);
    const [saved] = await store.listCards("s1", BUSINESS);
    if (!saved) throw new Error("test setup: card was not stored");

    const first = await store.updatePendingCard("s1", saved.id, { status: "approved" });
    const second = await store.updatePendingCard("s1", saved.id, { status: "skipped" });

    expect(first?.status).toBe("approved");
    expect(second).toBeNull();
    expect((await store.getCard("s1", saved.id))?.status).toBe("approved");
  });

  it("returns null for a card that does not exist", async () => {
    expect(await new MemoryStore().updatePendingCard("s1", "missing", { status: "approved" })).toBeNull();
  });
});

describe("useAiCall", () => {
  it("allows calls up to the cap for the day and refuses the rest", async () => {
    const store = new MemoryStore();
    const answers = [];
    for (let i = 0; i < 4; i++) answers.push(await store.useAiCall("2026-11-07", 3));
    expect(answers).toEqual([true, true, true, false]);
  });

  it("starts a new count on a new day", async () => {
    const store = new MemoryStore();
    await store.useAiCall("2026-11-07", 1);
    expect(await store.useAiCall("2026-11-07", 1)).toBe(false);
    expect(await store.useAiCall("2026-11-08", 1)).toBe(true);
  });
});

describe("session bound", () => {
  it("drops the oldest session once 2000 sessions have written, and reads never count", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 2000; i++) await store.ensureCards(`s${i}`, BUSINESS, [card]);
    // A visitor who only reads must not push a real session out.
    await store.listCards("reader-only", BUSINESS);
    expect(await store.listCards("s0", BUSINESS)).toHaveLength(1);

    await store.ensureCards("s2000", BUSINESS, [card]);
    expect(await store.listCards("s0", BUSINESS)).toHaveLength(0);
    expect(await store.listCards("s1", BUSINESS)).toHaveLength(1);
  });
});
