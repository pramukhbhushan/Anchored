import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { authErrorText } from "./errors";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `authErrorText`: every Supabase Auth failure becomes one plain
// sentence, and an unknown failure never leaks its raw message.

describe("authErrorText", () => {
  it("names the fix for errors a visitor can cause", () => {
    expect(authErrorText(new AuthApiError("raw", 429, "over_email_send_rate_limit"))).toMatch(/Wait a few minutes/);
    expect(authErrorText(new AuthApiError("raw", 400, "email_address_invalid"))).toMatch(/doesn't look right/);
    expect(authErrorText(new AuthApiError("raw", 422, "email_exists"))).toMatch(/Sign out, then sign in/);
  });

  it("says which sign-in method is off when the project disables one", () => {
    expect(authErrorText(new AuthApiError("raw", 422, "anonymous_provider_disabled"))).toMatch(/Guest access is off/);
    expect(authErrorText(new AuthApiError("raw", 400, "provider_disabled"))).toMatch(/Google sign-in is off/);
  });

  it("tells the visitor to check their connection when the service is unreachable", () => {
    expect(authErrorText(new AuthRetryableFetchError("Failed to fetch", 0))).toMatch(/connection/);
    expect(authErrorText(new TypeError("Failed to fetch"))).toMatch(/connection/);
  });

  it("falls back to a generic sentence instead of a raw message", () => {
    const text = authErrorText(new AuthApiError("internal detail", 500, "unexpected_failure"));
    expect(text).not.toContain("internal detail");
    expect(authErrorText(new Error("boom"))).toBe(text);
    expect(authErrorText("not an error")).toBe(text);
  });
});
