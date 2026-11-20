import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// What a verified webhook does for a business: an unpaid Stripe invoice
// becomes a reminder draft, even when Stripe holds a longer customer name than
// a reminder takes.

const state = vi.hoisted(() => ({ store: null as import("@/lib/store/memory").MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { receiveUnpaidInvoice } = await import("./hooks");

const SESSION = "owner";
const SHOP = hvacShop();

beforeEach(async () => {
  state.store = new MemoryStore();
  await state.store.saveBusiness(SESSION, SHOP);
  await state.store.setChoice(SESSION, SHOP.id, "books", { path: "build", skills: ["nudger"] });
});

describe("receiveUnpaidInvoice", () => {
  it("drafts a reminder for a customer whose Stripe name runs past 80 characters", async () => {
    const longName = `Riverside Property Management Holdings and Maintenance Services of Montgomery County LLC`;
    const target = { session: SESSION, business: SHOP, connection: { id: "c1", businessId: SHOP.id, kind: "stripe" as const, hookId: "a".repeat(24), settings: {}, secret: null, createdAt: "2026-11-01T00:00:00Z" } };

    const drafted = await receiveUnpaidInvoice(target, { kind: "overdue", customerName: longName, customerEmail: "ap@example.com", amountDue: 1200, number: "INV-7" });

    expect(drafted).toBe(true);
    const [card] = await state.store!.listCards(SESSION, SHOP.id);
    expect(card).toMatchObject({ skill: "nudger", to: "ap@example.com", stake: 1200 });
    expect(card?.title.startsWith(longName.slice(0, 80).trim())).toBe(true);
  });
});
