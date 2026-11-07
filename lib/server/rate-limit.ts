// =============================================================================
// Module Overview
// =============================================================================
// A fixed-window rate limiter held in memory, with no `node:` imports so the
// Edge runtime can run it. `createRateLimiter` returns a `RateLimiter` whose
// `check` counts a request against its key and says when the window resets.
// Each server instance keeps its own counts, so on Vercel every limit applies
// per instance; a shared store such as Redis would make the limits global.

/** How many requests one key may make per window. */
export interface RateLimitRule {
  readonly limit: number;
  readonly windowMs: number;
}

/** Whether a request may proceed, and whole seconds until its key's window resets. */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

/** Counts requests per key in fixed windows. */
export interface RateLimiter {
  /** Count one request for `key` under `rule` at `now` (ms since epoch) and say whether it may proceed. */
  check(key: string, rule: RateLimitRule, now?: number): RateLimitDecision;
  /** Return how many keys hold a window right now, expired or not. */
  size(): number;
}

/** Settings for `createRateLimiter`. */
export interface RateLimiterOptions {
  /** Most keys held at once; past it the oldest window is dropped. Default 10,000. */
  readonly maxKeys?: number;
}

interface CountWindow {
  count: number;
  readonly resetAt: number;
}

const DEFAULT_MAX_KEYS = 10_000;
// Sweeping every map entry on each request would cost O(keys); once a minute is enough.
const PRUNE_INTERVAL_MS = 60_000;

/** Return a new limiter with its own empty counts. Throws `RangeError` when `maxKeys` is not a positive integer. */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  if (!Number.isInteger(maxKeys) || maxKeys < 1) {
    throw new RangeError(`\`maxKeys\` must be a positive integer, got ${maxKeys}.`);
  }
  const windows = new Map<string, CountWindow>();
  let nextPruneAt = 0;

  /** Drop every window that has reset by `now`. */
  function prune(now: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
    nextPruneAt = now + PRUNE_INTERVAL_MS;
  }

  /** Start a fresh window for `key`, making room first so the map never passes `maxKeys`. */
  function open(key: string, rule: RateLimitRule, now: number): CountWindow {
    // Delete before set so the key moves to the end of the map's insertion order.
    windows.delete(key);
    if (windows.size >= maxKeys) prune(now);
    // Still full of live windows: evict the oldest. That key gets a fresh count,
    // which is the price of a hard memory bound under a flood of distinct keys.
    if (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (!oldest.done) windows.delete(oldest.value);
    }
    const window: CountWindow = { count: 0, resetAt: now + rule.windowMs };
    windows.set(key, window);
    return window;
  }

  return {
    check(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitDecision {
      if (now >= nextPruneAt) prune(now);
      const current = windows.get(key);
      const window = current !== undefined && current.resetAt > now ? current : open(key, rule, now);
      const retryAfterSeconds = Math.ceil((window.resetAt - now) / 1000);
      if (window.count >= rule.limit) return { allowed: false, retryAfterSeconds };
      window.count += 1;
      return { allowed: true, retryAfterSeconds };
    },
    size(): number {
      return windows.size;
    },
  };
}
