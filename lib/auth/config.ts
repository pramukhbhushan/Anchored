// =============================================================================
// Module Overview
// =============================================================================
// Whether accounts are on. `authConfig` returns the public Supabase URL and anon
// key, or `null` when either is unset; `isAuthEnabled` is the yes-or-no form.
// No imports, so `middleware.ts` (edge), server code and the browser share it.

/** The public settings Supabase Auth needs. Both are safe to ship to the browser. */
export interface AuthConfig {
  readonly url: string;
  readonly anonKey: string;
}

/** Return the Supabase Auth settings, or `null` when accounts are off. */
export function authConfig(): AuthConfig | null {
  // Spelled out in full: Next.js inlines only literal `process.env.NEXT_PUBLIC_*` reads into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Report whether accounts are on: both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. */
export function isAuthEnabled(): boolean {
  return authConfig() !== null;
}

/** Return the Supabase Auth settings, or throw when accounts are off. */
export function requireAuthConfig(): AuthConfig {
  const config = authConfig();
  if (config === null) {
    throw new Error("Accounts are off. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then rebuild.");
  }
  return config;
}
