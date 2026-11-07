import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { clientIp, isAllowedOrigin, isBodyTooLarge, limitFor, middleware } from "./middleware";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `middleware.ts`: which API mutations it refuses and why, which
// rate limit each route gets, and that requests it lets through still get the
// anonymous session cookie.

const HOST = "anchored.example.com";

/** Build a request to `path` on `HOST` from the client at `ip`. */
function request(path: string, init: { method?: string; ip: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(`https://${HOST}${path}`, {
    method: init.method ?? "GET",
    headers: { host: HOST, "x-forwarded-for": init.ip, ...init.headers },
  });
}

// =============================================================================
// Pure helpers
// =============================================================================

describe("isAllowedOrigin", () => {
  it("allows a request from the same host", () => {
    expect(isAllowedOrigin(`https://${HOST}`, HOST)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("allows a request with no `Origin`, such as one from curl", () => {
    expect(isAllowedOrigin(null, HOST)).toBe(true);
  });

  it("refuses a foreign origin", () => {
    expect(isAllowedOrigin("https://evil.example", HOST)).toBe(false);
    expect(isAllowedOrigin(`https://${HOST}.evil.example`, HOST)).toBe(false);
    expect(isAllowedOrigin("http://localhost:4000", "localhost:3000")).toBe(false);
  });

  it("refuses an opaque or malformed origin", () => {
    expect(isAllowedOrigin("null", HOST)).toBe(false);
    expect(isAllowedOrigin("not a url", HOST)).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first `x-forwarded-for` entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("falls back to `x-real-ip`, then to one shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("limitFor", () => {
  it("gives onboarding, which calls a paid model, the tightest limit", () => {
    expect(limitFor("POST", "/api/businesses").limit).toBe(10);
  });

  it("limits rewrites per card route", () => {
    expect(limitFor("POST", "/api/cards/abc-123/rewrite").limit).toBe(20);
  });

  it("shares one event limit between simulate and ingest", () => {
    const simulate = limitFor("POST", "/api/businesses/b_1/cards");
    const ingest = limitFor("POST", "/api/ingest/missed-call");
    expect(simulate.limit).toBe(60);
    expect(ingest.bucket).toBe(simulate.bucket);
  });

  it("puts every other mutation under the general limit", () => {
    for (const [method, path] of [
      ["PUT", "/api/businesses/b_1/choices"],
      ["POST", "/api/cards/abc-123"],
      ["POST", "/api/reset"],
      ["PUT", "/api/businesses"],
      ["POST", "/api/businesses/b_1"],
      ["POST", "/api/cards/abc/rewrite/extra"],
    ] as const) {
      expect(limitFor(method, path).limit, `${method} ${path}`).toBe(120);
    }
  });
});

describe("isBodyTooLarge", () => {
  it("refuses a declared length over 64 KB and allows one at the cap or unknown", () => {
    expect(isBodyTooLarge(String(64 * 1024 + 1))).toBe(true);
    expect(isBodyTooLarge(String(64 * 1024))).toBe(false);
    expect(isBodyTooLarge(null)).toBe(false);
  });
});

// =============================================================================
// middleware
// =============================================================================

describe("middleware", () => {
  it("refuses a cross-site API mutation with a JSON error", async () => {
    const response = middleware(request("/api/reset", { method: "POST", ip: "198.51.100.1", headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it("lets a cross-site GET through, since reads change nothing", () => {
    const response = middleware(request("/api/businesses/hvac/cards", { ip: "198.51.100.2", headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(200);
  });

  it("refuses a body over the cap with 413", async () => {
    const response = middleware(request("/api/reset", { method: "POST", ip: "198.51.100.3", headers: { "content-length": "70000" } }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: expect.stringContaining("64 KB") });
  });

  it("allows 10 onboarding requests per client, then answers 429 with `Retry-After`", async () => {
    const send = () => middleware(request("/api/businesses", { method: "POST", ip: "198.51.100.4", headers: { origin: `https://${HOST}` } }));
    const statuses = Array.from({ length: 10 }, () => send().status);
    expect(statuses.every((status) => status === 200)).toBe(true);

    const refused = send();
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toEqual({ error: expect.stringContaining("Too many requests") });
  });

  it("keeps a limited client's other routes and other clients working", () => {
    for (let i = 0; i < 11; i += 1) middleware(request("/api/businesses", { method: "POST", ip: "198.51.100.5" }));
    expect(middleware(request("/api/businesses", { method: "POST", ip: "198.51.100.5" })).status).toBe(429);
    expect(middleware(request("/api/reset", { method: "POST", ip: "198.51.100.5" })).status).toBe(200);
    expect(middleware(request("/api/businesses", { method: "POST", ip: "198.51.100.6" })).status).toBe(200);
  });

  it("gives a first-time visitor the session cookie", () => {
    const response = middleware(request("/", { ip: "198.51.100.7" }));
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("leaves an existing session cookie alone", () => {
    const response = middleware(request("/", { ip: "198.51.100.8", headers: { cookie: `${SESSION_COOKIE}=existing` } }));
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});
