import "server-only";
import { cache } from "react";
import { automationHref } from "@/components/routes";
import { automationsOf } from "@/components/workflows/automations";
import { workflowFlow } from "@/components/workflows/flow";
import { workflowIdsOf } from "@/lib/domain/paths";
import { groupByStage } from "@/lib/domain/stages";
import { getChoices, getFeed, listBusinesses } from "@/lib/server/data";
import type { CardRecord } from "@/lib/api/contract";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Server reads for the app shell. `businessSummaries` lists every business with
// its count of approvals waiting and its automations, once per request, so the
// shell layout and the business list page share one read. The sidebar lists a
// business's automations under Workflows, like threads under a project.

/** One automation in the sidebar, under its stage, with its drafts waiting. */
export interface SideAutomation {
  readonly key: string;
  readonly name: string;
  readonly stage: string;
  readonly href: string;
  readonly waiting: number;
}

/** What the shell shows for one business: its name, kind and approvals waiting. */
export interface BusinessSummary {
  readonly id: string;
  readonly name: string;
  readonly trade: string;
  readonly kind: BusinessProfile["kind"];
  /** Approvals waiting, or `null` when the count couldn't be read. */
  readonly pending: number | null;
  /** The business's automations, in stage order; left out where they couldn't be read. */
  readonly automations?: readonly SideAutomation[];
}

/** Return the pending cards for `business`, or `null` when the feed can't be read. */
async function pendingCards(business: BusinessProfile): Promise<CardRecord[] | null> {
  try {
    const { cards } = await getFeed(business);
    return cards.filter((card) => card.status === "pending");
  } catch (error) {
    // A badge is a nicety; one unreadable feed shouldn't take down the whole shell.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Shell] Couldn't count approvals for \`${business.id}\`; showing no badge. Reason: ${reason}`);
    return null;
  }
}

/** Return the automations of `business` for the sidebar, with no counts yet. */
async function sideAutomations(business: BusinessProfile): Promise<SideAutomation[] | undefined> {
  try {
    const choices = await getChoices(business);
    return groupByStage(workflowIdsOf(business)).flatMap(({ stage, workflows }) =>
      workflows.flatMap((id) =>
        automationsOf(workflowFlow(business, choices, id), stage).map((a) => ({
          key: a.key,
          name: a.name,
          stage: stage.name,
          href: automationHref(business.id, a.workflow, a.key),
          waiting: 0,
        })),
      ),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Shell] Couldn't list automations for \`${business.id}\`; the sidebar leaves them out. Reason: ${reason}`);
    return undefined;
  }
}

/** Return every business the viewer can open, the example first, each with its approvals count. */
// `cache` dedupes the read within one request: the layout and the `/app` page both call this.
export const businessSummaries = cache(async (): Promise<BusinessSummary[]> => {
  const businesses = await listBusinesses();
  return Promise.all(
    businesses.map(async (business) => {
      // The choices read is cached and runs beside the feed's, so the automations cost no extra round trip.
      const [pending, automations] = await Promise.all([
        pendingCards(business),
        sideAutomations(business),
      ]);
      return {
        id: business.id,
        name: business.name,
        trade: business.trade,
        kind: business.kind,
        pending: pending === null ? null : pending.length,
        automations: automations?.map((a) => ({ ...a, waiting: pending?.filter((card) => card.skill === a.key).length ?? 0 })),
      };
    }),
  );
});
