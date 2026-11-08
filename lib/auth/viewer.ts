// =============================================================================
// Module Overview
// =============================================================================
// The `Viewer`: who is behind a request, as `lib/server/session.ts` reads it and
// the account menu shows it. Types only, so client components can import it.

/** The visitor behind this request. */
export interface Viewer {
  /** The id the visitor's data is stored under: the Supabase user id, or the anonymous session id when accounts are off. */
  readonly id: string;
  /** The account's confirmed email, or `null` for a guest and when accounts are off. */
  readonly email: string | null;
  /** True for a Supabase guest, and for every visitor when accounts are off: no email is on file. */
  readonly isGuest: boolean;
  /** True when Supabase accounts are on. */
  readonly authEnabled: boolean;
}
