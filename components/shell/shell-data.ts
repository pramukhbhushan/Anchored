import "server-only";
import { cache } from "react";
import { presentAgents, type AgentView } from "@/components/business/agents/view-model";
import { activeAgents } from "@/lib/domain/paths";
import { getChoices, getFeed, listBusinesses } from "@/lib/server/data";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Server reads for the app shell. `businessSummaries` lists every business with
// its count of approvals waiting and the agents at work for it, once per
// request, so the shell layout and the business list page share one read.

/** What the shell shows for one business: its name, kind, approvals waiting and active agents. */
export interface BusinessSummary {
  readonly id: string;
  readonly name: string;
  readonly trade: string;
  readonly kind: BusinessProfile["kind"];
  /** Approvals waiting, or `null` when the count couldn't be read. */
  readonly pending: number | null;
  /** Active agents, for the sidebar's links to their pages; left out where they couldn't be read. */
  readonly agents?: readonly Pick<AgentView, "id" | "name">[];
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

/** Return the agents at work for `business`, or `undefined` when its choices can't be read. */
async function sideAgents(business: BusinessProfile): Promise<Pick<AgentView, "id" | "name">[] | undefined> {
  try {
    const choices = await getChoices(business);
    return presentAgents(activeAgents(business, choices)).map(({ id, name }) => ({ id, name }));
  } catch (error) {
    // The agent links are a shortcut; Workflows still reaches every agent when they can't be read.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Shell] Couldn't list agents for \`${business.id}\`; the sidebar leaves them out. Reason: ${reason}`);
    return undefined;
  }
}

/** Return every business the viewer can open, the example first, each with its approvals count and agents. */
// `cache` dedupes the read within one request: the layout and the `/app` page both call this.
export const businessSummaries = cache(async (): Promise<BusinessSummary[]> => {
  const businesses = await listBusinesses();
  return Promise.all(
    businesses.map(async (business) => {
      const [pending, agents] = await Promise.all([pendingCount(business), sideAgents(business)]);
      return { id: business.id, name: business.name, trade: business.trade, kind: business.kind, pending, ...(agents === undefined ? {} : { agents }) };
    }),
  );
});
