import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";

// =============================================================================
// Module Overview
// =============================================================================
// `receiveTelegramUpdate` on the in-memory store: an update runs once, a retry
// after it finished is a duplicate, a retry while it still runs is told to wait,
// and a failed run frees its claim so the next retry runs it again.

const NOW = new Date("2026-11-09T15:00:00Z");
const IGNORED = { kind: "ignored", updateId: 41 } as const;
// A blocked bot records the block before anything else, so a failing write here fails the update.
const BLOCKED = { kind: "blocked", updateId: 42, chatId: "123" } as const;

const state = vi.hoisted(() => ({ store: null as MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { receiveTelegramUpdate } = await import("./telegram-hooks");

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

beforeEach(() => {
  state.store = new MemoryStore();
});

describe("receiveTelegramUpdate", () => {
  it("runs an update once and answers a later retry as a duplicate", async () => {
    expect(await receiveTelegramUpdate(IGNORED, NOW)).toEqual({ status: "done", outcome: "ignored" });
    expect(await receiveTelegramUpdate(IGNORED, NOW)).toEqual({ status: "duplicate" });
  });

  it("tells a retry to wait while another worker holds the claim", async () => {
    await store().claimTelegramUpdate(IGNORED.updateId, NOW.toISOString(), 60_000);
    expect(await receiveTelegramUpdate(IGNORED, NOW)).toEqual({ status: "busy" });
  });

  it("frees the claim when the update fails, so the next retry runs it", async () => {
    vi.spyOn(store(), "setTelegramChatBlocked").mockRejectedValueOnce(new Error("Database write failed"));
    await expect(receiveTelegramUpdate(BLOCKED, NOW)).rejects.toThrow("Database write failed");
    expect(await store().telegramUpdateDone(BLOCKED.updateId)).toBe(false);
    expect(await receiveTelegramUpdate(BLOCKED, NOW)).toMatchObject({ status: "done" });
  });
});
