import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { clientIp, clientKey, isBodyTooLarge, limitFor, middleware } from "./middleware";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `middleware.ts`: which API mutations it refuses and why, the
// per-session and per-IP rate limits, the anonymous session cookie when accounts
// are off, and the `/app` sign-in redirect when they are on. Signed-in requests
// carry a token signed by a local key, so no test reaches a live Supabase project.

const HOST = "anchored.example.com";
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SUPABASE_URL = "https://project-ref.supabase.co";
// `@supabase/supabase-js` names the session cookie after the project ref in the URL.
const AUTH_COOKIE = "sb-project-ref-auth-token";

/** Build a request to `path` on `HOST` from the client at `ip`. */
function request(path: string, init: { method?: string; ip: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(`https://${HOST}${path}`, {
    method: init.method ?? "GET",
    headers: { host: HOST, "x-forwarded-for": init.ip, ...init.headers },
  });
}

/** Send one onboarding request, the route with the tightest limits, and return its status. */
async function createBusiness(ip: string, cookie?: string): Promise<number> {
  const headers = cookie === undefined ? undefined : { cookie };
  return (await middleware(request("/api/businesses", { method: "POST", ip, headers }))).status;
}

/** Send `count` onboarding requests and return their statuses. */
async function createBusinesses(count: number, ip: string, cookie?: string): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) statuses.push(await createBusiness(ip, cookie));
  return statuses;
}

/** Turn accounts on or off for the tests in a block. */
function useAccounts(enabled: boolean): void {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", enabled ? SUPABASE_URL : "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", enabled ? "test-anon-key" : "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}

// =============================================================================
// Signed-in sessions without a live Supabase project
// =============================================================================

const toBase64Url = (data: string | ArrayBuffer): string =>
  (typeof data === "string" ? Buffer.from(data) : Buffer.from(new Uint8Array(data))).toString("base64url");

/** A local ES256 key, published the way Supabase publishes its JWKS. */
interface SigningKey {
  readonly privateKey: CryptoKey;
  readonly jwks: { keys: JsonWebKey[] };
}

/** Make a signing key whose public half a stubbed JWKS endpoint can serve. */
async function makeSigningKey(): Promise<SigningKey> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, jwks: { keys: [{ ...publicJwk, kid: "test-key", alg: "ES256", use: "sig" } as JsonWebKey] } };
}

/** Return a `cookie` header holding a valid Supabase session for `userId`, in the `@supabase/ssr` cookie format. */
async function sessionCookie(key: SigningKey, userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "ES256", typ: "JWT", kid: "test-key" }));
  const payload = toBase64Url(
    JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600, aal: "aal1", session_id: crypto.randomUUID(), is_anonymous: false }),
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  const session = {
    access_token: `${header}.${payload}.${toBase64Url(signature)}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "test-refresh-token",
    user: { id: userId, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date(now * 1000).toISOString() },
  };
  return `${AUTH_COOKIE}=base64-${toBase64Url(JSON.stringify(session))}`;
}

// =============================================================================
// Pure helpers
// =============================================================================

describe("clientIp", () => {
  it("prefers `x-real-ip`, which Vercel sets itself, over a client-supplied `x-forwarded-for`", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("falls back to the first `x-forwarded-for` entry, then to one shared bucket", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": " " }))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("clientKey", () => {
  it("keys an IPv4 client by its whole address", () => {
    expect(clientKey("203.0.113.7")).toBe("203.0.113.7");
    expect(clientKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("keys every address in one IPv6 /64 the same, however it is written", () => {
    const key = clientKey("2001:db8:85a3:12::1");
    expect(key).toBe("2001:db8:85a3:12::/64");
    expect(clientKey("2001:0DB8:85a3:0012:ffff:ffff:ffff:fffe")).toBe(key);
    expect(clientKey("[2001:db8:85a3:12::abcd]")).toBe(key);
    expect(clientKey("2001:db8:85a3:12::7%eth0")).toBe(key);
  });

  it("gives neighboring IPv6 /64s different keys", () => {
    expect(clientKey("2001:db8:85a3:13::1")).not.toBe(clientKey("2001:db8:85a3:12::1"));
    expect(clientKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });

  it("keeps an address it can't parse as its own key", () => {
    expect(clientKey("1:2:3")).toBe("1:2:3");
    expect(clientKey(":::")).toBe(":::");
    expect(clientKey("unknown")).toBe("unknown");
  });
});

describe("limitFor", () => {
  it("gives onboarding, which calls a paid model, the tightest limits", () => {
    expect(limitFor("POST", "/api/businesses")).toMatchObject({ perSession: 10, perIp: 60 });
  });

  it("limits rewrites per card route", () => {
    expect(limitFor("POST", "/api/cards/abc-123/rewrite")).toMatchObject({ perSession: 20, perIp: 120 });
  });

  it("shares one chat limit between onboarding turns and the business chat", () => {
    const start = limitFor("POST", "/api/intake");
    const answer = limitFor("POST", "/api/intake/abc-123");
    const chat = limitFor("POST", "/api/businesses/b_1/chat");
    expect(start.perIp).toBeGreaterThan(start.perSession);
    expect(answer.bucket).toBe(start.bucket);
    expect(chat.bucket).toBe(start.bucket);
  });

  it("shares one event limit between simulate, ingest and reading the invoice sheet", () => {
    const simulate = limitFor("POST", "/api/businesses/b_1/cards");
    const ingest = limitFor("POST", "/api/ingest/missed-call");
    const sheet = limitFor("POST", "/api/businesses/b_1/invoice-sheet");
    expect(simulate).toMatchObject({ perSession: 60, perIp: 300 });
    expect(ingest.bucket).toBe(simulate.bucket);
    expect(sheet.bucket).toBe(simulate.bucket);
  });

  it("gives connecting a service and saving a contact their own bucket", () => {
    for (const [method, path] of [
      ["PUT", "/api/businesses/b_1/connections"],
      ["DELETE", "/api/businesses/b_1/connections"],
      ["POST", "/api/businesses/b_1/contacts"],
      ["DELETE", "/api/businesses/b_1/contacts/c_1"],
    ] as const) {
      expect(limitFor(method, path), `${method} ${path}`).toMatchObject({ bucket: "connect", perSession: 60, perIp: 300 });
    }
  });

  it("lets provider webhooks through on a loose per-IP limit", () => {
    expect(limitFor("POST", "/api/hooks/twilio/abc/sms")).toMatchObject({ bucket: "hook", perIp: 3000 });
    expect(limitFor("POST", "/api/hooks/email")).toMatchObject({ bucket: "hook" });
  });

  it("puts every other mutation under the general limits", () => {
    for (const [method, path] of [
      ["PUT", "/api/businesses/b_1/choices"],
      ["PUT", "/api/businesses/b_1/plan"],
      ["POST", "/api/cards/abc-123"],
      ["DELETE", "/api/businesses"],
      ["PUT", "/api/businesses"],
      ["POST", "/api/businesses/b_1"],
      ["POST", "/api/cards/abc/rewrite/extra"],
      ["POST", "/api/intake/abc/extra"],
    ] as const) {
      expect(limitFor(method, path), `${method} ${path}`).toMatchObject({ perSession: 120, perIp: 600 });
    }
  });
});

describe("isBodyTooLarge", () => {
  it("refuses a declared length over 64 KB and allows one at the cap or unknown", () => {
    expect(isBodyTooLarge(String(64 * 1024 + 1))).toBe(true);
    expect(isBodyTooLarge(String(64 * 1024))).toBe(false);
    expect(isBodyTooLarge(null)).toBe(false);
  });

  it("takes a larger cap for a route that allows one", () => {
    expect(isBodyTooLarge(String(1024 * 1024), 4 * 1024 * 1024)).toBe(false);
  });
});

// =============================================================================
// middleware with accounts off
// =============================================================================

describe("middleware with accounts off", () => {
  useAccounts(false);

  it("refuses a cross-site API mutation with a JSON error", async () => {
    const response = await middleware(request("/api/businesses", { method: "DELETE", ip: "198.51.100.1", headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it("lets a cross-site GET through, since reads change nothing", async () => {
    const response = await middleware(request("/api/businesses/restaurant/cards", { ip: "198.51.100.2", headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(200);
  });

  it("refuses a body over the cap with 413", async () => {
    const response = await middleware(request("/api/businesses", { method: "DELETE", ip: "198.51.100.3", headers: { "content-length": "70000" } }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: expect.stringContaining("64 KB") });
  });

  it("allows 10 onboarding requests per session, then answers 429 with `Retry-After`", async () => {
    const cookie = `${SESSION_COOKIE}=${crypto.randomUUID()}`;
    expect(await createBusinesses(10, "198.51.100.4", cookie)).toEqual(Array(10).fill(200));

    const refused = await middleware(request("/api/businesses", { method: "POST", ip: "198.51.100.4", headers: { cookie } }));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toEqual({ error: expect.stringContaining("Too many requests") });
  });

  it("fits three onboardings and a dozen chat messages in one session, then holds it to a ceiling", async () => {
    const cookie = `${SESSION_COOKIE}=${crypto.randomUUID()}`;
    const ip = "198.51.100.40";
    const turn = async (path: string) => (await middleware(request(path, { method: "POST", ip, headers: { cookie } }))).status;
    // One onboarding runs 11 to 14 chat calls, and an owner may onboard more than once.
    for (let onboarding = 0; onboarding < 3; onboarding += 1) {
      for (let call = 0; call < 14; call += 1) expect(await turn("/api/intake/abc-123"), `onboarding ${onboarding + 1}`).toBe(200);
    }
    for (let message = 0; message < 12; message += 1) expect(await turn("/api/businesses/b_1/chat"), `message ${message + 1}`).toBe(200);
    const statuses: number[] = [];
    for (let call = 0; call < 200; call += 1) statuses.push(await turn("/api/businesses/b_1/chat"));
    expect(statuses).toContain(429);
  });

  it("keeps a limited session's other routes working", async () => {
    const cookie = `${SESSION_COOKIE}=${crypto.randomUUID()}`;
    await createBusinesses(10, "198.51.100.5", cookie);
    expect(await createBusiness("198.51.100.5", cookie)).toBe(429);
    expect((await middleware(request("/api/businesses", { method: "DELETE", ip: "198.51.100.5", headers: { cookie } }))).status).toBe(200);
  });

  it("lets a room of judges on one IP each onboard, up to the looser per-IP limit", async () => {
    const ip = "198.51.100.6";
    for (let judge = 0; judge < 6; judge += 1) {
      expect(await createBusinesses(10, ip, `${SESSION_COOKIE}=${crypto.randomUUID()}`), `judge ${judge + 1}`).toEqual(Array(10).fill(200));
    }
    expect(await createBusiness(ip, `${SESSION_COOKIE}=${crypto.randomUUID()}`)).toBe(429);
    expect(await createBusiness("198.51.100.66", `${SESSION_COOKIE}=${crypto.randomUUID()}`)).toBe(200);
  });

  it("doesn't let a session that hits its own limit spend the room's shared IP budget", async () => {
    const ip = "198.51.100.12";
    const greedy = `${SESSION_COOKIE}=${crypto.randomUUID()}`;
    await createBusinesses(40, ip, greedy);
    for (let judge = 0; judge < 5; judge += 1) {
      expect(await createBusinesses(10, ip, `${SESSION_COOKIE}=${crypto.randomUUID()}`), `judge ${judge + 1}`).toEqual(Array(10).fill(200));
    }
  });

  it("holds a client that drops its cookie to the IP limit, counting an IPv6 /64 as one client", async () => {
    const from = (n: number) =>
      middleware(request("/api/businesses", { method: "POST", ip: "198.51.100.99", headers: { "x-real-ip": `2001:db8:aa:1::${n.toString(16)}` } }));
    for (let n = 1; n <= 60; n += 1) expect((await from(n)).status, `request ${n}`).toBe(200);
    expect((await from(61)).status).toBe(429);
  });

  it("gives a first-time visitor the session cookie", async () => {
    const response = await middleware(request("/", { ip: "198.51.100.7" }));
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toMatch(UUID_SHAPE);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("leaves a well-formed session cookie alone", async () => {
    const response = await middleware(request("/", { ip: "198.51.100.8", headers: { cookie: `${SESSION_COOKIE}=${crypto.randomUUID()}` } }));
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("replaces a session cookie that is empty, hand-edited or oversized with a fresh UUID", async () => {
    for (const value of ["", "x", "existing", "a".repeat(3500), `${crypto.randomUUID()}x`]) {
      const response = await middleware(request("/", { ip: "198.51.100.10", headers: { cookie: `${SESSION_COOKIE}=${value}` } }));
      expect(response.cookies.get(SESSION_COOKIE)?.value, `cookie value of length ${value.length}`).toMatch(UUID_SHAPE);
    }
  });

  it("lets a visitor reach the app without signing in", async () => {
    const response = await middleware(request("/app/b/restaurant", { ip: "198.51.100.11" }));
    expect(response.status).toBe(200);
  });
});

// =============================================================================
// middleware with accounts on
// =============================================================================

describe("middleware with accounts on", () => {
  useAccounts(true);

  let key: SigningKey;
  beforeAll(async () => {
    key = await makeSigningKey();
  });
  beforeEach(() => {
    // `getClaims` checks a token's signature against the project's published keys.
    const jwksUrl = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
      String(input) === jwksUrl ? Response.json(key.jwks) : new Response("Not stubbed", { status: 500 }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a signed-out visitor bound for the app to sign in, keeping the path and query", async () => {
    const response = await middleware(request("/app/b/restaurant/tools?workflow=quotes", { ip: "198.51.100.20" }));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.host).toBe(HOST);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/app/b/restaurant/tools?workflow=quotes");
  });

  it("guards `/app` itself but not paths that only start with the same letters", async () => {
    expect((await middleware(request("/app", { ip: "198.51.100.21" }))).status).toBe(307);
    expect((await middleware(request("/apple", { ip: "198.51.100.21" }))).status).toBe(200);
  });

  it("lets a signed-out visitor reach the landing and sign-in pages", async () => {
    expect((await middleware(request("/", { ip: "198.51.100.22" }))).status).toBe(200);
    expect((await middleware(request("/login?next=%2Fapp", { ip: "198.51.100.22" }))).status).toBe(200);
  });

  it("lets a signed-in visitor into the app", async () => {
    const cookie = await sessionCookie(key, crypto.randomUUID());
    expect((await middleware(request("/app/b/restaurant", { ip: "198.51.100.25", headers: { cookie } }))).status).toBe(200);
  });

  it("refuses a session whose token was signed by some other key", async () => {
    const forged = await sessionCookie(await makeSigningKey(), crypto.randomUUID());
    expect((await middleware(request("/app", { ip: "198.51.100.26", headers: { cookie: forged } }))).status).toBe(307);
  });

  it("counts a signed-in user's mutations against their account, from any address", async () => {
    const owner = await sessionCookie(key, crypto.randomUUID());
    expect(await createBusinesses(10, "198.51.100.27", owner)).toEqual(Array(10).fill(200));
    expect(await createBusiness("198.51.100.28", owner)).toBe(429);
    expect(await createBusiness("198.51.100.27", await sessionCookie(key, crypto.randomUUID()))).toBe(200);
  });

  it("stops issuing the anonymous session cookie", async () => {
    const response = await middleware(request("/", { ip: "198.51.100.23" }));
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("still refuses a cross-site API mutation before any session work", async () => {
    const response = await middleware(request("/api/businesses", { method: "DELETE", ip: "198.51.100.24", headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
  });
});
