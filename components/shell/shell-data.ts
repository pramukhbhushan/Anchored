import "server-only";
import { cache } from "react";
import { isAuthEnabled } from "@/lib/auth/config";
import { isAiConfigured } from "@/lib/server/ai";
import { getFeed, listBusinesses } from "@/lib/server/data";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Server reads for the app shell. `businessSummaries` lists every business with
// its count of approvals waiting, once per request, so the shell layout and the
// business list page share one read. `demoStatus` says which services are off.

/** What the shell shows for one business: its name, kind and approvals waiting. */
export interface BusinessSummary {
  readonly id: string;
  readonly name: string;
  readonly trade: string;
  readonly kind: BusinessProfile["kind"];
  /** Approvals waiting, or `null` when the count couldn't be read. */
  readonly pending: number | null;
}

/** Which outside services this server has, so the shell can say when it runs as a demo. */
export interface DemoStatus {
  readonly aiOn: boolean;
  readonly databaseOn: boolean;
  readonly accountsOn: boolean;
}

/** Return the count of pending cards for `business`, or `null` when the feed can't be read. */
async function pendingCount(business: BusinessProfile): Promise<number | null> {
  try {
    const { cards } = await getFeed(business);
    return cards.filter((card) => card.status === "pending").length;
  } catch (error) {
    // A badge is a nicety; one unreadable feed shouldn't take down the whole shell.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Shell] Couldn't count approvals for \`${business.id}\`; showing no badge. Reason: ${reason}`);
    return null;
  }
}

/** Return every business the viewer can open, case studies first, each with its approvals count. */
// `cache` dedupes the read within one request: the layout and the `/app` page both call this.
export const businessSummaries = cache(async (): Promise<BusinessSummary[]> => {
  const businesses = await listBusinesses();
  return Promise.all(
    businesses.map(async (business) => ({
      id: business.id,
      name: business.name,
      trade: business.trade,
      kind: business.kind,
      pending: await pendingCount(business),
    })),
  );
});

/** Report whether an AI provider, a database and accounts are configured. */
export function demoStatus(): DemoStatus {
  // Mirrors `createStore` in `lib/store/index.ts`, which picks Supabase only when both a URL and the service key are set.
  const databaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return {
    aiOn: isAiConfigured(),
    databaseOn: Boolean(databaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY),
    accountsOn: isAuthEnabled(),
  };
}
