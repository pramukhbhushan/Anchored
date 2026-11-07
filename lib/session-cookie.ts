// =============================================================================
// Module Overview
// =============================================================================
// The anonymous demo session cookie. It has no imports so both `middleware.ts`
// (edge runtime) and server code can share `SESSION_COOKIE` and its options.

/** Cookie that ties a visitor to their own businesses, choices and cards. */
export const SESSION_COOKIE = "anchored_session";

/** Thirty days: long enough to revisit a demo, short enough not to linger. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
