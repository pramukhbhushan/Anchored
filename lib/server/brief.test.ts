import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The daily brief job: Run now writes one owner-only card from code-counted
// numbers and replaces the unread one before it; a run that overlaps another
// does nothing; a failed run keeps the last good brief and its window; the
// scheduled pass writes once a day from 7 a.m.; and the shared example has none.

const state = vi.hoisted(() => ({ store: null as import("@/lib/store/memory").MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { readBrief, runBrief, runDueBriefs } = await import("./brief");

const SESSION = "owner";
const SHOP = hvacShop();
// 10 a.m. and 6 a.m. in New York, November 9.
const TEN_AM = new Date("2026-11-09T15:00:00Z");
const SIX_AM = new Date("2026-11-09T11:00:00Z");

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(TEN_AM);
  state.store = new MemoryStore();
  await store().saveBusiness(SESSION, SHOP);
  await store().ensureCards(SESSION, SHOP.id, [
    { key: "q1", agent: "followup", skill: "closer", title: "Quote to the Lees", body: "", reason: "", checks: [], action: "Send text", channel: "sms", stake: 4200 },
    { key: "a1", agent: "frontdesk", skill: "inquiry", title: "Allergy question from Sam", body: "", reason: "", checks: [], action: "I'll handle it", channel: "locked" },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runBrief", () => {
  it("writes one owner-only card from the counts and remembers it as the last brief", async () => {
    const brief = await runBrief(SESSION, SHOP, TEN_AM);
    expect(brief.lines).toEqual([
      "1 needs you personally: Allergy question from Sam.",
      "2 drafts wait for your OK, worth about $4,200. Start with: Quote to the Lees.",
      "In the past 24 hours: 2 new drafts.",
    ]);
    const card = (await store().listCards(SESSION, SHOP.id)).find((c) => c.skill === "brief");
    expect(card).toMatchObject({ key: brief.cardKey, channel: "flag", status: "pending", body: brief.lines.join("\n") });
    expect(await readBrief(SESSION, SHOP)).toEqual(brief);
    expect(await store().listOutbox(SESSION, SHOP.id)).toEqual([]);
  });

  it("counts only what's new since the last brief, and replaces the unread one", async () => {
    const first = await runBrief(SESSION, SHOP, TEN_AM);
    const second = await runBrief(SESSION, SHOP, new Date(TEN_AM.getTime() + 60_000));
    expect(second.snapshot?.from).toBe(first.lastRunAt);
    expect(second.lines.at(-1)).toBe("Since your last brief: nothing new.");
    const briefs = (await store().listCards(SESSION, SHOP.id)).filter((c) => c.skill === "brief").map((c) => c.status);
    expect(briefs).toEqual(["superseded", "pending"]);
  });

  it("does nothing while another run is going, and returns the last finished brief", async () => {
    const first = await runBrief(SESSION, SHOP, TEN_AM);
    await store().claimBriefRun(SESSION, SHOP.id, new Date(TEN_AM.getTime() + 1000).toISOString(), 120_000);
    const overlap = await runBrief(SESSION, SHOP, new Date(TEN_AM.getTime() + 2000));
    expect(overlap).toMatchObject({ running: true, cardKey: first.cardKey });
    expect((await store().listCards(SESSION, SHOP.id)).filter((c) => c.skill === "brief")).toHaveLength(1);
  });

  it("keeps the last good brief and its window when a run fails", async () => {
    const first = await runBrief(SESSION, SHOP, TEN_AM);
    const broken = vi.spyOn(store(), "listOutbox").mockRejectedValueOnce(new Error("database down"));
    await expect(runBrief(SESSION, SHOP, new Date(TEN_AM.getTime() + 60_000))).rejects.toThrow("database down");
    broken.mockRestore();
    expect(await readBrief(SESSION, SHOP)).toEqual(first);
    // The failed run let go of its claim, so the next one runs at once.
    expect((await runBrief(SESSION, SHOP, new Date(TEN_AM.getTime() + 120_000))).running).toBe(false);
  });

  it("gives the shared example no brief", async () => {
    expect((await runBrief(SESSION, SAMPLE_BUSINESS, TEN_AM)).unavailableReason).toContain("shared example");
  });

  it("reads as no brief yet before the first one", async () => {
    expect(await readBrief(SESSION, SHOP)).toMatchObject({ lastRunAt: null, snapshot: null, lines: [expect.stringContaining("No brief yet")] });
  });
});

describe("runDueBriefs", () => {
  it("waits for 7 a.m., then writes each business's brief once that day", async () => {
    expect(await runDueBriefs(SIX_AM)).toEqual({ written: 0, skipped: 0, failed: 0 });
    expect(await runDueBriefs(TEN_AM)).toEqual({ written: 1, skipped: 0, failed: 0 });
    expect(await runDueBriefs(new Date(TEN_AM.getTime() + 60 * 60 * 1000))).toEqual({ written: 0, skipped: 1, failed: 0 });
    // The next morning brings a new one.
    expect(await runDueBriefs(new Date(TEN_AM.getTime() + 24 * 60 * 60 * 1000))).toMatchObject({ written: 1 });
  });
});
