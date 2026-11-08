import { describe, expect, it } from "vitest";
import { callbackUrl, loginHref, needsSignIn, safeNextPath } from "./paths";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `lib/auth/paths.ts`: which paths sit behind sign-in, which `next`
// values may be redirected to after sign-in, and the links built from them.

describe("needsSignIn", () => {
  it("covers the app and every page inside it", () => {
    expect(needsSignIn("/app")).toBe(true);
    expect(needsSignIn("/app/")).toBe(true);
    expect(needsSignIn("/app/b/restaurant/workflows")).toBe(true);
  });

  it("leaves the public pages, the API and look-alike paths open", () => {
    for (const path of ["/", "/login", "/auth/callback", "/built", "/api/businesses", "/apple", "/application"]) {
      expect(needsSignIn(path), path).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps a path on this site with its query and fragment", () => {
    expect(safeNextPath("/app/b/restaurant?workflow=quotes#tools")).toBe("/app/b/restaurant?workflow=quotes#tools");
    expect(safeNextPath("/")).toBe("/");
  });

  it("falls back to `/app` when `next` is missing or empty", () => {
    expect(safeNextPath(null)).toBe("/app");
    expect(safeNextPath(undefined)).toBe("/app");
    expect(safeNextPath("")).toBe("/app");
  });

  it("refuses anything a browser would read as another site", () => {
    for (const next of [
      "https://evil.example/app",
      "//evil.example/app",
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "javascript:alert(1)",
      "app",
    ]) {
      expect(safeNextPath(next), JSON.stringify(next)).toBe("/app");
    }
  });

  it("refuses the sign-in steps themselves, so signing in can't loop", () => {
    expect(safeNextPath("/login?next=/app")).toBe("/app");
    expect(safeNextPath("/auth/callback?code=x")).toBe("/app");
    expect(safeNextPath("/auth/signout")).toBe("/app");
  });

  it("uses the fallback it is given", () => {
    expect(safeNextPath("//evil.example", "/")).toBe("/");
  });
});

describe("loginHref and callbackUrl", () => {
  it("carry `next` encoded, so its own query survives the round trip", () => {
    const next = "/app/b/restaurant?workflow=quotes&x=1";
    const login = new URL(loginHref(next), "https://anchored.example.com");
    expect(login.pathname).toBe("/login");
    expect(login.searchParams.get("next")).toBe(next);

    const callback = new URL(callbackUrl("https://anchored.example.com", next));
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe(next);
  });
});
