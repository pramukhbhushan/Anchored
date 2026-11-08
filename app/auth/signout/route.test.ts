import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// =============================================================================
// Module Overview
// =============================================================================
// Signing out with accounts on: the route ends this browser's Supabase session,
// clears its cookie, and sends the visitor to the landing page with a 303. It
// refuses a post from another site. `fetch` plays Supabase Auth, and a cookie
// jar stands in for `next/headers`, so no test reaches a live project.

const HOST = "anchored.example.com";
const SUPABASE_URL = "https://project-ref.supabase.co";
// `@supabase/supabase-js` names the session cookie after the project ref in the URL.
const AUTH_COOKIE = "sb-project-ref-auth-token";

interface JarCookie {
  readonly name: string;
  readonly value: string;
  readonly options?: { readonly maxAge?: number };
}

// The request's cookies as `next/headers` would hand them to the route, and what the route set on them.
let incoming: JarCookie[] = [];
let written: JarCookie[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => incoming.map(({ name, value }) => ({ name, value })),
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      written.push({ name, value, options });
    },
  }),
}));

const toBase64Url = (text: string): string => Buffer.from(text).toString("base64url");

/** Return a session cookie in the `@supabase/ssr` format. `signOut` never checks the token's signature. */
function sessionCookie(): JarCookie {
  const now = Math.floor(Date.now() / 1000);
  const token = [
    toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    toBase64Url(JSON.stringify({ sub: "u_1", aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600, session_id: "s_1" })),
    "signature",
  ].join(".");
  const session = {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "test-refresh-token",
    user: { id: "u_1", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  return { name: AUTH_COOKIE, value: `base64-${toBase64Url(JSON.stringify(session))}` };
}

function signOutRequest(origin: string): NextRequest {
  return new NextRequest(`https://${HOST}/auth/signout`, { method: "POST", headers: { host: HOST, origin } });
}

describe("POST /auth/signout with accounts on", () => {
  let logoutCalls: string[] = [];

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    incoming = [sessionCookie()];
    written = [];
    logoutCalls = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith(`${SUPABASE_URL}/auth/v1/logout`)) {
        logoutCalls.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response("Not stubbed", { status: 500 });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ends this browser's session, clears its cookie and sends the visitor to the landing page", async () => {
    const response = await POST(signOutRequest(`https://${HOST}`));

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/");
    expect(logoutCalls).toEqual([`${SUPABASE_URL}/auth/v1/logout?scope=local`]);
    expect(written).toContainEqual(expect.objectContaining({ name: AUTH_COOKIE, value: "", options: expect.objectContaining({ maxAge: 0 }) }));
  });

  it("still sends the visitor home when Supabase can't end the session", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ message: "down" }), { status: 500 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(signOutRequest(`https://${HOST}`));

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/");
  });

  it("refuses a sign-out posted from another site and keeps the session", async () => {
    const response = await POST(signOutRequest("https://evil.example"));

    expect(response.status).toBe(403);
    expect(logoutCalls).toEqual([]);
    expect(written).toEqual([]);
  });
});
