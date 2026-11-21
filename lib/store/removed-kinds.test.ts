import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseStore } from "./supabase";

// =============================================================================
// Module Overview
// =============================================================================
// Rows a database may still hold from features Anchored removed: forwarded
// email connections, and Telegram cards and outbox entries. The Supabase
// adapter reads them through a fake HTTP answer and skips them rather than
// crashing or handing them to code that no longer knows them.

afterEach(() => vi.unstubAllGlobals());

/** Answer every request with `rows`, as PostgREST would; a single-row read gets the first row. Returns the URLs asked for. */
function answerWith(rows: readonly Record<string, unknown>[]): URL[] {
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      urls.push(new URL(String(input)));
      const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object") ?? false;
      return Response.json(single ? (rows[0] ?? null) : rows);
    }),
  );
  return urls;
}

const store = () => new SupabaseStore("https://database.test", "service-test");

/** A stored connection row of `kind` for business `shop`. */
function connectionRow(kind: string, hookId: string): Record<string, unknown> {
  return { id: `c_${kind}`, session_id: "owner", business_id: "shop", kind, hook_id: hookId, settings: {}, secret: null, created_at: "2026-11-01T00:00:00Z" };
}

/** A stored card row on `channel`. */
function cardRow(channel: string, key: string): Record<string, unknown> {
  const draft = { agent: "frontdesk", skill: "inquiry", title: "Reply to Dana", body: "Thanks for writing.", reason: "", checks: [], action: "Send", channel, to: "Dana" };
  return { id: `card_${key}`, business_id: "shop", key, draft, status: "pending", edited: false, created_at: "2026-11-01T00:00:00Z", decided_at: null };
}

/** A stored, queued outbox row on `channel`. */
function outboxRow(channel: string, id: string): Record<string, unknown> {
  return { id, session_id: "owner", business_id: "shop", card_id: null, channel, recipient: "Dana", body: "Thanks for writing.", sent_at: "2026-11-01T00:00:00Z", delivery: "queued", delivery_note: null, provider_id: null };
}

describe("connections of a removed kind", () => {
  it("are left out when a business's connections are listed", async () => {
    answerWith([connectionRow("email-in", "m".repeat(24)), connectionRow("stripe", "s".repeat(24))]);

    const listed = await store().listConnections("owner", "shop");

    expect(listed.map((connection) => connection.kind)).toEqual(["stripe"]);
  });

  it("find no business for their hook id", async () => {
    answerWith([connectionRow("email-in", "m".repeat(24))]);

    expect(await store().findConnection("m".repeat(24))).toBeNull();
  });
});

describe("cards and outbox rows on a removed channel", () => {
  it("leave Telegram cards out of a business's cards, and find none by id", async () => {
    answerWith([cardRow("telegram", "tg"), cardRow("email", "em")]);

    expect((await store().listCards("owner", "shop")).map((card) => card.key)).toEqual(["em"]);

    answerWith([cardRow("telegram", "tg")]);
    expect(await store().getCard("owner", "card_tg")).toBeNull();
  });

  it("leave Telegram entries out of the outbox and out of the scheduled sender's work", async () => {
    const urls = answerWith([outboxRow("telegram", "tg"), outboxRow("sms", "tx")]);

    expect((await store().listOutbox("owner", "shop")).map((entry) => entry.id)).toEqual(["tx"]);
    expect((await store().listDueOutbox("2026-11-02T00:00:00Z", 50)).map(({ entry }) => entry.id)).toEqual(["tx"]);
    // The sender asks only for channels it can send, so old Telegram rows never use up its limit.
    expect(urls.at(-1)?.searchParams.get("channel")).toBe("in.(sms,email,list)");
  });
});
