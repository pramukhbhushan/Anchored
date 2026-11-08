import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's acknowledgment rule: on until turned off, the exact text shown
// with it, the approval time kept after it's turned off, and the shared
// example refused.

const state = vi.hoisted(() => ({ store: null as import("@/lib/store/memory").MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { readStandingRules, RuleLockedError, setAcknowledgment } = await import("./standing-rules");

const SHOP = hvacShop();

beforeEach(async () => {
  state.store = new MemoryStore();
  await state.store.saveBusiness("guest", SHOP);
});

describe("the acknowledgment rule", () => {
  it("starts on and shows the exact text it sends", async () => {
    expect(await readStandingRules("guest", SHOP)).toEqual({
      acknowledge: { enabled: true, approvedAt: null },
      template: `Thanks, ${SHOP.name} got your message and will reply soon.`,
      unavailableReason: null,
    });
  });

  it("answers with the saved state, and keeps the approval time once turned off", async () => {
    const on = await setAcknowledgment("guest", SHOP, true, new Date("2026-11-08T15:00:00Z"));
    expect(on.acknowledge).toEqual({ enabled: true, approvedAt: "2026-11-08T15:00:00.000Z" });
    const off = await setAcknowledgment("guest", SHOP, false, new Date("2026-11-08T16:00:00Z"));
    expect(off.acknowledge).toEqual({ enabled: false, approvedAt: "2026-11-08T15:00:00.000Z" });
  });

  it("stays in its own session", async () => {
    await setAcknowledgment("guest", SHOP, false);
    expect((await readStandingRules("someone-else", SHOP)).acknowledge.enabled).toBe(true);
  });

  it("can't change on the shared example", async () => {
    await expect(setAcknowledgment("guest", SAMPLE_BUSINESS, true)).rejects.toBeInstanceOf(RuleLockedError);
    expect((await readStandingRules("guest", SAMPLE_BUSINESS)).unavailableReason).toContain("shared example");
  });
});
