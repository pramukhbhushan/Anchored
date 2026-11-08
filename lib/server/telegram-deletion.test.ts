import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { canDeleteTelegram, deleteDispatchedTelegram } from "./dispatch";

// =============================================================================
// Module Overview
// =============================================================================
// Deletion retains audit history and uses only identities already stored for
// this owner's business. Concurrent requests, tenant boundaries, provider
// failures and the exact 48-hour boundary never become false success.

const env = { TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_BOT_USERNAME: "TestBot" };
const now = new Date("2026-11-10T12:00:00Z");
async function setup() {
  const store = new MemoryStore();
  const contact = await store.saveContact("owner", { businessId: "shop", name: "Dana", phone: null, email: null, consent: null, optedOutAt: null, telegramChatId: "123" });
  const entry = await store.addOutbox("owner", { businessId: "shop", cardId: null, channel: "telegram", contactId: contact.id, to: "Dana", body: "Hello", delivery: "sent", sentAt: "2026-11-09T12:00:00Z" });
  await store.settleOutbox("owner", entry.id, { delivery: "sent", providerId: "42" });
  return { store, entry: (await store.listOutbox("owner", "shop"))[0]! };
}
const success = (_input: string, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }));

describe("Telegram removal", () => {
  it("checks the exact provider window and known sent identity", async () => {
    const { entry } = await setup();
    expect(canDeleteTelegram(entry, now, env)).toBe(true);
    expect(canDeleteTelegram(entry, new Date("2026-11-11T12:00:00Z"), env)).toBe(false);
    expect(canDeleteTelegram(entry, new Date("2026-11-09T11:59:00Z"), env)).toBe(false);
    expect(canDeleteTelegram({ ...entry, providerId: undefined }, now, env)).toBe(false);
    expect(canDeleteTelegram({ ...entry, delivery: "queued" }, now, env)).toBe(false);
  });
  it("removes once and preserves the original body and sent outcome", async () => {
    const { store, entry } = await setup();
    const fetch = vi.fn(success);
    const results = await Promise.all([1, 2].map(() => deleteDispatchedTelegram(store, "owner", "shop", entry.id, now, { env, fetch })));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ chat_id: "123", message_id: 42 });
    expect((await store.listOutbox("owner", "shop"))[0]).toMatchObject({ body: "Hello", delivery: "sent", deletionState: "deleted", providerId: "42" });
    expect((await deleteDispatchedTelegram(store, "owner", "shop", entry.id, now, { env, fetch })).deleted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not reveal another session's or business's entry", async () => {
    const { store, entry } = await setup();
    const fetch = vi.fn(success);
    expect((await deleteDispatchedTelegram(store, "other", "shop", entry.id, now, { env, fetch })).status).toBe(404);
    expect((await deleteDispatchedTelegram(store, "owner", "other", entry.id, now, { env, fetch })).status).toBe(404);
    expect(await store.claimTelegramDeletion("other", "shop", entry.id)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports provider failure without changing the sent delivery", async () => {
    const { store, entry } = await setup();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: message can't be deleted" }), { status: 400 }));
    expect((await deleteDispatchedTelegram(store, "owner", "shop", entry.id, now, { env, fetch })).status).toBe(502);
    expect((await store.listOutbox("owner", "shop"))[0]).toMatchObject({ delivery: "sent", deletionState: "failed" });
  });
  it("treats an already absent message as removed without claiming it was unread", async () => {
    const { store, entry } = await setup();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: message to delete not found" }), { status: 400 }));
    const result = await deleteDispatchedTelegram(store, "owner", "shop", entry.id, now, { env, fetch });
    expect(result.deleted).toBe(true);
    expect(result.message).toContain("already have read");
  });
});
