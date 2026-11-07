import { describe, expect, it } from "vitest";
import { createRateLimiter, type RateLimitRule } from "./rate-limit";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `createRateLimiter`: how many requests a key gets per window,
// when the window resets, and that memory stays bounded as keys come and go.

const MINUTE_MS = 60_000;
const THREE_PER_TEN_MINUTES: RateLimitRule = { limit: 3, windowMs: 10 * MINUTE_MS };
const START = Date.UTC(2026, 10, 7, 12, 0, 0);

describe("createRateLimiter", () => {
  it("allows `limit` requests in a window, then refuses with the seconds left", () => {
    const limiter = createRateLimiter();
    const allowed = [0, 1, 2].map((i) => limiter.check("ip-a", THREE_PER_TEN_MINUTES, START + i * 1000).allowed);
    expect(allowed).toEqual([true, true, true]);

    const refused = limiter.check("ip-a", THREE_PER_TEN_MINUTES, START + 4 * MINUTE_MS);
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 6 * 60 });
  });

  it("keeps refusing for the rest of the window", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 3; i += 1) limiter.check("ip-a", THREE_PER_TEN_MINUTES, START);
    expect(limiter.check("ip-a", THREE_PER_TEN_MINUTES, START + 1).allowed).toBe(false);
    expect(limiter.check("ip-a", THREE_PER_TEN_MINUTES, START + 10 * MINUTE_MS - 1)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("allows the key again once the window resets", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 4; i += 1) limiter.check("ip-a", THREE_PER_TEN_MINUTES, START);

    const afterReset = limiter.check("ip-a", THREE_PER_TEN_MINUTES, START + 10 * MINUTE_MS);
    expect(afterReset).toEqual({ allowed: true, retryAfterSeconds: 10 * 60 });
  });

  it("counts each key on its own", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 4; i += 1) limiter.check("ip-a", THREE_PER_TEN_MINUTES, START);

    expect(limiter.check("ip-a", THREE_PER_TEN_MINUTES, START).allowed).toBe(false);
    expect(limiter.check("ip-b", THREE_PER_TEN_MINUTES, START).allowed).toBe(true);
  });

  it("drops expired windows so memory doesn't grow with old keys", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 50; i += 1) limiter.check(`ip-${i}`, THREE_PER_TEN_MINUTES, START);
    expect(limiter.size()).toBe(50);

    limiter.check("ip-late", THREE_PER_TEN_MINUTES, START + 11 * MINUTE_MS);
    expect(limiter.size()).toBe(1);
  });

  it("never holds more than `maxKeys` windows, even while all are live", () => {
    const limiter = createRateLimiter({ maxKeys: 3 });
    for (let i = 0; i < 10; i += 1) limiter.check(`ip-${i}`, THREE_PER_TEN_MINUTES, START + i);
    expect(limiter.size()).toBe(3);
    // The newest keys survive, so a key already at its limit stays refused.
    for (let i = 0; i < 3; i += 1) limiter.check("ip-9", THREE_PER_TEN_MINUTES, START + 20);
    expect(limiter.check("ip-9", THREE_PER_TEN_MINUTES, START + 21).allowed).toBe(false);
  });

  it("rejects a `maxKeys` that isn't a positive integer", () => {
    expect(() => createRateLimiter({ maxKeys: 0 })).toThrow(RangeError);
  });
});
