import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `getStore` picks the persistence backend once per server process: Supabase
// when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, memory otherwise.

export type { Store } from "./types";
export { NotFoundError } from "./types";

// Next.js dev mode reloads modules on every edit; keeping the store on
// `globalThis` stops each reload from wiping the in-memory demo data.
const holder = globalThis as typeof globalThis & { __anchoredStore?: Store };

/** Return the process-wide `Store`, creating it on first use. */
export function getStore(): Store {
  if (holder.__anchoredStore) return holder.__anchoredStore;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    holder.__anchoredStore = new SupabaseStore(url, key);
  } else {
    console.warn("[Store] `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is unset; falling back to the in-memory store. Data resets when the server restarts.");
    holder.__anchoredStore = new MemoryStore();
  }
  return holder.__anchoredStore;
}
