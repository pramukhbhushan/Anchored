import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecordedFollowup } from "@/lib/domain/followups";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";

// =============================================================================
// Module Overview
// =============================================================================
// Store boundaries for recorded work and removal: memory owns its records,
// while the real Supabase adapter's HTTP requests must scope every operation
// by session and business. These fake HTTP checks do not claim live RLS proof.

const record: RecordedFollowup = { id: "timer", businessId: "shop", contactId: "customer", skill: "callback", dueAt: "2026-11-10T12:00:00Z", state: "missed-call", sourceId: "call:1", evidence: "Owner's call log", status: "active" };
afterEach(() => vi.unstubAllGlobals());

describe("recorded work stores", () => {
  it("keeps memory records scoped and clears them on reset", async () => {
    const store = new MemoryStore();
    await store.saveFollowup("owner", record);
    expect(await store.listFollowups("other", "shop")).toEqual([]);
    expect(await store.listFollowups("owner", "other")).toEqual([]);
    const returned = await store.listFollowups("owner", "shop");
    Object.assign(returned[0]!, { status: "cancelled" });
    expect((await store.listFollowups("owner", "shop"))[0]?.status).toBe("active");
    await store.reset("owner");
    expect(await store.listFollowups("owner", "shop")).toEqual([]);
  });

  it("filters Supabase reads and writes with stored ownership and stable conflict identity", async () => {
    const calls: { url: URL; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      return new Response(JSON.stringify(init?.method === "POST" ? null : [{ record }]), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const store = new SupabaseStore("https://database.test", "service-test");
    await store.saveFollowup("owner", record);
    expect(JSON.parse(calls[0]!.init!.body as string)).toMatchObject({ session_id: "owner", business_id: "shop", id: "timer", record });
    expect(calls[0]!.url.searchParams.get("on_conflict")).toBe("session_id,business_id,id");
    expect(await store.listFollowups("owner", "shop")).toEqual([record]);
    expect(calls[1]!.url.searchParams.get("session_id")).toBe("eq.owner");
    expect(calls[1]!.url.searchParams.get("business_id")).toBe("eq.shop");
  });

  it("claims Supabase removal atomically with business, session, delivery and state guards", async () => {
    let called: URL | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      called = new URL(String(input));
      return new Response(JSON.stringify({ id: "outbox", business_id: "shop", card_id: null, channel: "telegram", recipient: "Dana", body: "Hello", sent_at: "2026-11-10T12:00:00Z", delivery: "sent", delivery_note: null, rule: null, contact_id: "customer", provider_id: "42", deletion_state: "deleting", deletion_note: null }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const store = new SupabaseStore("https://database.test", "service-test");
    expect(await store.claimTelegramDeletion("owner", "shop", "outbox")).toMatchObject({ providerId: "42", deletionState: "deleting" });
    const params = new URL(String(called)).searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ session_id: "eq.owner", business_id: "eq.shop", id: "eq.outbox", channel: "eq.telegram", delivery: "eq.sent", or: "(deletion_state.is.null,deletion_state.eq.failed)" });
  });

  it("includes follow-up rows in Supabase reset using the current session", async () => {
    const calls: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      calls.push(new URL(String(input)));
      // Reset also lists the session's post photos in Storage, which answers with a JSON list; tables answer 204.
      return String(input).includes("/storage/v1/") ? Response.json([]) : new Response(null, { status: 204 });
    }));
    await new SupabaseStore("https://database.test", "service-test").reset("owner");
    const tables = calls.filter((url) => url.pathname.includes("/rest/v1/"));
    expect(tables.some((url) => url.pathname.endsWith("/customer_followups") && url.searchParams.get("session_id") === "eq.owner")).toBe(true);
    expect(tables.every((url) => url.searchParams.get("session_id") === "eq.owner")).toBe(true);
  });
});
