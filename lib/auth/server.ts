import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireAuthConfig } from "./config";

// =============================================================================
// Module Overview
// =============================================================================
// The Supabase Auth client for server components, route handlers and server
// actions. `createServerSupabase` reads and writes the session through
// `next/headers` cookies, so create one per request and never share it.

/** Return a Supabase client bound to this request's session cookies. Throws when accounts are off. */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const { url, anonKey } = requireAuthConfig();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server components can't set cookies. `middleware.ts` refreshes the session
          // before every render, so a token refresh lost here is redone on the next request.
        }
      },
    },
  });
}
