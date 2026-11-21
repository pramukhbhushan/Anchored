import type { Metadata } from "next";
import { businessHref } from "@/components/routes";
import { monthlyBill } from "@/components/stack/bill";
import { FreeHelp } from "@/components/stack/FreeHelp";
import { MonthlyBill } from "@/components/stack/MonthlyBill";
import { UnderTheHood } from "@/components/stack/UnderTheHood";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { activeAgents, chosenTools } from "@/lib/domain/paths";
import { aiSetup } from "@/lib/server/ai";
import { getSessionId } from "@/lib/server/session";
import { getBusinessOrNotFound, getChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The stack, told for the owner: the monthly bill as a stacked bar over four
// groups with free help beside it, a pointer to the Workflows graph, where each
// job's steps are drawn, then the technical detail in a closed "Under the hood"
// disclosure. Every piece is drawn from this business's picks.

export const metadata: Metadata = { title: "Stack" };

/** Render the bill, the way to the graph of work and the under-the-hood detail for the business in the URL. */
export default async function StackPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const session = await getSessionId();
  const [choices, ai] = await Promise.all([getChoices(business), aiSetup({ session, businessId: business.id })]);
  // A tool chosen for two workflows gets one panel; the first pick wins, as on the bill.
  const tools = chosenTools(business, choices).filter((x, i, all) => all.findIndex((y) => y.tool.id === x.tool.id) === i);

  return (
    <>
      <PageHeader title="Stack" description="What your plan costs each month, and what each piece does." />

      <div className="with-rail">
        <MonthlyBill bill={monthlyBill(business, choices)} />
        <FreeHelp />
      </div>

      <section className="section" aria-labelledby="flow-title">
        <SectionHeader
          id="flow-title"
          title="How work moves"
          description="Each job's steps, from what starts it to what you get, are drawn on your Workflows page."
          action={
            <ButtonLink href={businessHref(business.id, "workflows")} variant="secondary">
              See how work moves
            </ButtonLink>
          }
        />
      </section>

      <UnderTheHood business={business} agents={activeAgents(business, choices)} tools={tools} ai={ai} />
    </>
  );
}
