import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { json, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// Who a request belongs to when accounts are on. A real Supabase client reads a
// real signed session cookie; only the network is faked, playing Supabase Auth.
// Pages read the session id on every click, so it must not cost a call to
// Supabase Auth when the project signs tokens with an asymmetric key.

const SUPABASE_URL = "https://abcd.supabase.co";
const SESSION_COOKIE = "sb-abcd-auth-token";
const USER_ID = "8f5e2a1c-3b4d-4e6f-8a9b-0c1d2e3f4a5b";
const KEY_ID = "test-signing-key";

const jar = vi.hoisted(() => ({ cookies: [] as { name: string; value: string }[] }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => jar.cookies,
    get: (name: string) => jar.cookies.find((cookie) => cookie.name === name),
    set: () => {},
  }),
}));

const { findViewer, getSessionId, SignInRequiredError } = await import("./session");

/** Encode `text` or bytes as base64url, the way JWTs and Supabase cookies carry them. */
function base64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  return Buffer.from(bytes).toString("base64url");
}

/** Return a JWT for `claims`, signed with `privateKey` under `alg`. */
async function signToken(claims: Record<string, unknown>, privateKey: CryptoKey, alg: "ES256" | "HS256"): Promise<string> {
  const head = base64url(JSON.stringify({ alg, typ: "JWT", kid: KEY_ID }));
  const body = base64url(JSON.stringify(claims));
  const algorithm = alg === "ES256" ? { name: "ECDSA", hash: "SHA-256" } : { name: "HMAC" };
  const signature = await crypto.subtle.sign(algorithm, privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${base64url(signature)}`;
}

/** Return the claims Supabase Auth puts in a guest's token. */
function guestClaims(): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return { sub: USER_ID, aud: "authenticated", role: "authenticated", email: "", is_anonymous: true, iat: now, exp: now + 3600 };
}

/** Sign the browser in with `token`, as the session cookie `@supabase/ssr` writes. */
function signInWith(token: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: token,
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: USER_ID, aud: "authenticated", role: "authenticated", email: "", is_anonymous: true, app_metadata: {}, user_metadata: {} },
  };
  jar.cookies = [{ name: SESSION_COOKIE, value: `base64-${base64url(JSON.stringify(session))}` }];
}

let signingKeys: CryptoKeyPair;
let publicJwk: JsonWebKey;
let genuineToken: string;
let authUserCalls: number;

/** Play Supabase Auth: publish the signing key, and answer `/user` for the genuine token only. */
function fakeSupabaseAuth() {
  authUserCalls = 0;
  stubFetch((url, init) => {
    if (url === `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) return json({ keys: [{ ...publicJwk, kid: KEY_ID, alg: "ES256", use: "sig" }] });
    if (url === `${SUPABASE_URL}/auth/v1/user`) {
      authUserCalls += 1;
      const sent = new Headers(init?.headers).get("authorization");
      if (sent !== `Bearer ${genuineToken}`) return json({ code: 403, error_code: "bad_jwt", msg: "invalid JWT" }, 403);
      // The guest confirmed an email under "Save your work"; the token in the cookie predates that.
      return json({ id: USER_ID, aud: "authenticated", role: "authenticated", email: "owner@example.com", is_anonymous: false, app_metadata: {}, user_metadata: {} });
    }
    throw new Error(`test setup: unexpected request to ${url}`);
  });
}

beforeAll(async () => {
  signingKeys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  publicJwk = await crypto.subtle.exportKey("jwk", signingKeys.publicKey);
});

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  // supabase-js warns about reading a session on the server; that is what these tests do on purpose.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  genuineToken = await signToken(guestClaims(), signingKeys.privateKey, "ES256");
  fakeSupabaseAuth();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("with an asymmetric signing key", () => {
  it("reads the session id for a page without a call to Supabase Auth", async () => {
    signInWith(genuineToken);

    expect(await getSessionId()).toBe(USER_ID);
    expect(authUserCalls).toBe(0);
  });

  it("refuses a token signed with any other key", async () => {
    const otherKeys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    signInWith(await signToken(guestClaims(), otherKeys.privateKey, "ES256"));

    await expect(getSessionId()).rejects.toBeInstanceOf(SignInRequiredError);
  });

  it("refuses an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    signInWith(await signToken({ ...guestClaims(), iat: past - 3600, exp: past }, signingKeys.privateKey, "ES256"));

    await expect(getSessionId()).rejects.toBeInstanceOf(SignInRequiredError);
  });

  it("shows a guest who just confirmed an email as signed in with it, though the token predates it", async () => {
    signInWith(genuineToken);

    expect(await findViewer()).toEqual({ id: USER_ID, email: "owner@example.com", isGuest: false, authEnabled: true });
  });
});

describe("with the legacy shared secret", () => {
  it("asks Supabase Auth, and refuses a token it rejects", async () => {
    const secret = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    signInWith(await signToken(guestClaims(), secret, "HS256"));

    await expect(getSessionId()).rejects.toBeInstanceOf(SignInRequiredError);
    expect(authUserCalls).toBe(1);
  });
});
