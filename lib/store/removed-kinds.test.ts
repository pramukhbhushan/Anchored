import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseStore } from "./supabase";

// =============================================================================
// Module Overview
// =============================================================================
// Rows a database may still hold from features Anchored removed. The Supabase
// adapter reads them through a fake HTTP answer and skips them rather than
// crashing or handing them to code that no longer knows them.

afterEach(() => vi.unstubAllGlobals());

/** Answer every request with `rows`, as PostgREST would; a single-row read gets the first row. */
function answerWith(rows: readonly Record<string, unknown>[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: string | URL, init?: RequestInit) => {
      const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object") ?? false;
      return Response.json(single ? (rows[0] ?? null) : rows);
    }),
  );
}

const store = () => new SupabaseStore("https://database.test", "service-test");

/** A stored connection row of `kind` for business `shop`. */
function connectionRow(kind: string, hookId: string): Record<string, unknown> {
  return { id: `c_${kind}`, session_id: "owner", business_id: "shop", kind, hook_id: hookId, settings: {}, secret: null, created_at: "2026-11-01T00:00:00Z" };
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
