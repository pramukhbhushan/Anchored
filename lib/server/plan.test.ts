import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// `approveBusinessPlan` on the in-memory store: the owner's yes is saved with
// the time and each workflow's pick, and another session's business is never
// found.

const SESSION = "owner";
const SHOP = hvacShop();
const NOW = new Date("2026-11-09T15:00:00Z");

const state = vi.hoisted(() => ({ store: null as MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { approveBusinessPlan } = await import("./plan");

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

beforeEach(async () => {
  state.store = new MemoryStore();
  await store().saveBusiness(SESSION, SHOP);
});

describe("approveBusinessPlan", () => {
  it("saves the approval with the time and the owner's saved pick", async () => {
    await store().setChoice(SESSION, SHOP.id, "calls", { path: "build", skills: ["callback"] });
    const approval = await approveBusinessPlan(SESSION, SHOP.id, NOW);
    expect(approval?.approvedAt).toBe(NOW.toISOString());
    expect(approval?.choices.calls).toMatchObject({ path: "build", skills: ["callback"] });
    expect((await store().getBusiness(SESSION, SHOP.id))?.planApproval).toEqual(approval);
  });

  it("returns null for a business the session doesn't have", async () => {
    expect(await approveBusinessPlan("someone-else", SHOP.id, NOW)).toBeNull();
  });
});
