// =============================================================================
// Module Overview
// =============================================================================
// The anonymous session cookie, used when accounts are off, as in local
// development and CI. It has no imports so both `middleware.ts`
// (edge runtime) and server code can share `SESSION_COOKIE` and its options.

/** Cookie that ties a visitor to their own businesses, choices and cards. */
export const SESSION_COOKIE = "anchored_session";

/** Thirty days: long enough to come back to, short enough not to linger. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
