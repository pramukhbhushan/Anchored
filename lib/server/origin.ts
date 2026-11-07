// =============================================================================
// Module Overview
// =============================================================================
// The cross-site check for requests that change data. `isAllowedOrigin` compares
// a request's `Origin` header with its `Host`. It has no imports, so both
// `middleware.ts` on the edge and route handlers such as sign-out can call it.

/** Report whether a mutation's `Origin` header allows it: absent, or naming `host`. */
export function isAllowedOrigin(origin: string | null, host: string): boolean {
  // Only browsers send `Origin`, and only a browser carries a visitor's cookie for them.
  if (origin === null) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    // The literal "null" that sandboxed frames and file pages send lands here too.
    return false;
  }
  return originHost.toLowerCase() === host.toLowerCase();
}
