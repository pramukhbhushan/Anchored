import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The Telegram test link: a guest's own business gets one that stays the same
// on every read and leads back to it, the shared example never does, and a
// server with no bot says so instead of showing a broken link.

const state = vi.hoisted(() => ({ store: null as import("@/lib/store/memory").MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { telegramSetup } = await import("./telegram-setup");

const ENV = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_BOT_USERNAME: "AnchoredBot" };
const SHOP = hvacShop();

beforeEach(async () => {
  state.store = new MemoryStore();
  await state.store.saveBusiness("guest", SHOP);
});

describe("telegramSetup", () => {
  it("gives the business one stable link that names it to the webhook", async () => {
    const first = await telegramSetup("guest", SHOP, ENV);
    expect(first.url).toMatch(/^https:\/\/t\.me\/AnchoredBot\?start=[a-z0-9]{24}$/);
    expect(await telegramSetup("guest", SHOP, ENV)).toEqual(first);
    const hookId = first.url?.split("start=")[1] ?? "";
    expect(await state.store?.findTelegramHook(hookId)).toEqual({ session: "guest", businessId: SHOP.id });
  });

  it("never gives the shared example a link", async () => {
    expect(await telegramSetup("guest", SAMPLE_BUSINESS, ENV)).toEqual({ url: null, unavailableReason: expect.stringContaining("shared example") });
  });

  it("says so when the server has no bot set up", async () => {
    expect(await telegramSetup("guest", SHOP, {})).toEqual({ url: null, unavailableReason: expect.stringContaining("isn't set up") });
  });
});
