import { describe, expect, it } from "vitest";
import { isSessionId } from "./session-id";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `isSessionId`: the anonymous session cookie must hold a UUID.

describe("isSessionId", () => {
  it("accepts a UUID from `crypto.randomUUID`, in either case", () => {
    const id = crypto.randomUUID();
    expect(isSessionId(id)).toBe(true);
    expect(isSessionId(id.toUpperCase())).toBe(true);
  });

  it("refuses a missing, empty, short, padded or oversized value", () => {
    const id = crypto.randomUUID();
    for (const value of [undefined, null, "", "x", "existing", ` ${id}`, `${id}0`, id.replaceAll("-", ""), "a".repeat(3500)]) {
      expect(isSessionId(value), String(value).slice(0, 40)).toBe(false);
    }
  });
});
