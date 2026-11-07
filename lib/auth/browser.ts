import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthConfig } from "./config";

// =============================================================================
// Module Overview
// =============================================================================
// The Supabase Auth client for client components. It keeps the session in
// cookies, not local storage, so the server sees the same signed-in user.

/** Return the browser's Supabase client, the same instance on every call. Throws when accounts are off. */
export function createBrowserSupabase(): SupabaseClient {
  const { url, anonKey } = requireAuthConfig();
  // `createBrowserClient` returns one shared instance in the browser, so calling this per click is cheap.
  return createBrowserClient(url, anonKey);
}
