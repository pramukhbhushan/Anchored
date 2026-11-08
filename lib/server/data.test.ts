import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import type { BusinessProfile } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// How long the page reads wait on the database. Each store read here takes one
// fixed round trip on a fake clock, the way a Supabase query does in
// production, so a test can count how many round trips a page waits for
// before it can render.

const SESSION = "test-session";
const ROUND_TRIP_MS = 100;

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("./session", () => ({ getSessionId: async () => SESSION }));

const { getFeed } = await import("./data");
const { businessSummaries } = await import("@/components/shell/shell-data");

/** Wrap `store` so every method answers after one round trip. */
function withRoundTrip(store: Store): Store {
  return new Proxy(store, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await new Promise((resolve) => setTimeout(resolve, ROUND_TRIP_MS));
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

/** Return how many round trips `read` waited for before it settled. */
async function roundTripsFor(read: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  let settledAt: number | null = null;
  void read().then(() => {
    settledAt = Date.now();
  });
  await vi.runAllTimersAsync();
  if (settledAt === null) throw new Error("test setup: the read never settled");
  return (settledAt - start) / ROUND_TRIP_MS;
}

const OWN_BUSINESS: BusinessProfile = { ...SAMPLE_BUSINESS, id: "b_test", name: "Test Shop", kind: "custom" };

beforeEach(async () => {
  const memory = new MemoryStore();
  await memory.saveBusiness(SESSION, OWN_BUSINESS);
  stores.current = withRoundTrip(memory);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("page reads", () => {
  it("load a business's cards in one database round trip", async () => {
    expect(await roundTripsFor(() => getFeed(OWN_BUSINESS))).toBe(1);
  });

  it("load the sidebar's businesses and approval counts in two round trips", async () => {
    expect(await roundTripsFor(() => businessSummaries())).toBe(2);
  });
});
