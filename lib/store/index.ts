import "server-only";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `getStore` picks the persistence backend once per server process: Supabase
// when `isDatabaseConfigured` finds a project URL and `SUPABASE_SERVICE_ROLE_KEY`,
// memory otherwise. In production, missing settings throw on first use instead
// of falling back, unless `ANCHORED_ALLOW_MEMORY_STORE=1` asks for memory on purpose.

export type { Store } from "./types";
export { NotFoundError } from "./types";

// Next.js dev mode reloads modules on every edit; keeping the store on
// `globalThis` stops each reload from wiping the in-memory demo data.
const holder = globalThis as typeof globalThis & { __anchoredStore?: Store };

/** Return the process-wide `Store`, creating it on first use. */
export function getStore(): Store {
  holder.__anchoredStore ??= createStore();
  return holder.__anchoredStore;
}

/** Report whether a Supabase database is configured, so data is saved there rather than in memory. */
export function isDatabaseConfigured(): boolean {
  return databaseSettings() !== null;
}

/** Return the Supabase project URL and service key, or `null` when either is unset. */
function databaseSettings(): { readonly url: string; readonly key: string } | null {
  // `SUPABASE_URL` wins; the public auth URL names the same project, so one variable can serve both.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

/** Build the backend the environment names, refusing to lose data silently in production. */
function createStore(): Store {
  const database = databaseSettings();
  if (database !== null) return new SupabaseStore(database.url, database.key);

  // A public deploy on memory would drop every visitor's work at each restart and grow without limit.
  if (process.env.NODE_ENV === "production" && process.env.ANCHORED_ALLOW_MEMORY_STORE !== "1") {
    throw new Error(
      "Supabase is not configured for this production build. Set `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`, or set `ANCHORED_ALLOW_MEMORY_STORE=1` to run on the in-memory store.",
    );
  }
  console.warn("[Store] No Supabase URL or `SUPABASE_SERVICE_ROLE_KEY`; falling back to the in-memory store. Data resets when the server restarts.");
  return new MemoryStore();
}
