import type { Metadata } from "next";
import { businessHref } from "@/components/routes";
import { monthlyBill } from "@/components/stack/bill";
import { FreeHelp } from "@/components/stack/FreeHelp";
import { workFlow } from "@/components/stack/flow";
import { MonthlyBill } from "@/components/stack/MonthlyBill";
import { UnderTheHood } from "@/components/stack/UnderTheHood";
import { WorkFlow } from "@/components/stack/WorkFlow";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { feedStats } from "@/components/view-helpers";
import { activeAgents, chosenTools } from "@/lib/domain/paths";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The stack, told for the owner: the monthly bill as a stacked bar over four
// groups with free help beside it, then a flow diagram from what a customer
// does to what the owner gets, then the technical detail in a closed
// "Under the hood" disclosure. Every piece is drawn from this business's picks.

export const metadata: Metadata = { title: "Stack" };

/** Render the bill, the flow of work and the under-the-hood detail for the business in the URL. */
export default async function StackPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, feed] = await Promise.all([getChoices(business), getFeed(business)]);
  // A tool chosen for two workflows gets one panel; the first pick's path wins, as on the bill.
  const tools = chosenTools(business, choices).filter((x, i, all) => all.findIndex((y) => y.tool.id === x.tool.id) === i);

  return (
    <>
      <PageHeader
        title="Stack"
        description="What your plan costs each month, and where each job goes once it starts."
        actions={
          <ButtonLink href={businessHref(business.id, "workflows")} variant="secondary">
            Change paths
          </ButtonLink>
        }
      />

      <div className="with-rail">
        <MonthlyBill bill={monthlyBill(business, choices)} />
        <FreeHelp />
      </div>

      <section className="section" aria-labelledby="flow-title">
        <SectionHeader id="flow-title" title="How work moves" />
        <WorkFlow
          lanes={workFlow(business, choices)}
          approvalsHref={businessHref(business.id, "approvals")}
          workflowsHref={businessHref(business.id, "workflows")}
          waiting={feedStats(feed.cards).pending}
        />
      </section>

      <UnderTheHood business={business} agents={activeAgents(business, choices)} tools={tools} />
    </>
  );
}
