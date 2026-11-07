// =============================================================================
// Module Overview
// =============================================================================
// The shape of an anonymous session id. `middleware.ts` mints one with
// `crypto.randomUUID()`, and `isSessionId` lets both the edge and the server
// refuse any cookie value that isn't a UUID.

// Case-insensitive and any version: the check is about shape, so ids from older builds still pass.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Report whether `value` is a well-formed session id, a UUID. */
export function isSessionId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
