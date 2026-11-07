import type { Metadata } from "next";
import { OpenFromHash } from "@/components/business/OpenFromHash";
import { OppCard } from "@/components/business/OppCard";
import { businessHref } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { placeOf, plannedWorkflows, type PlannedWorkflow } from "@/components/view-helpers";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile, Choice, WorkflowId } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The Workflows page: the landing hero's work order, extended to every
// workflow the business has. One line per workflow, best fit first, the five
// every business shares and then the ones onboarding added. Each line opens to
// change its path; `#wf-<id>` opens and scrolls to one.

export const metadata: Metadata = { title: "Workflows" };

/** Render one group of work-order lines under its label, best fit first. */
function Group({
  business,
  label,
  list,
  choices,
}: {
  readonly business: BusinessProfile;
  readonly label: string;
  readonly list: readonly PlannedWorkflow[];
  readonly choices: Record<WorkflowId, Choice>;
}) {
  // Array sort is stable, so equal fits keep the catalog order.
  const ranked = [...list].sort((a, z) => z.plan.fit - a.plan.fit);
  return (
    <section className="wf-group" aria-label={label}>
      <h3 className="wf-label">{label}</h3>
      {ranked.map((w) => (
        <OppCard key={w.id} business={business} id={w.id} plan={w.plan} choice={choices[w.id]} />
      ))}
    </section>
  );
}

/** Render the work order for the business in the URL. */
export default async function WorkflowsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const choices = await getChoices(business);
  const planned = plannedWorkflows(business);
  const shared = planned.filter((w) => WORKFLOWS[w.id].base);
  const added = planned.filter((w) => !WORKFLOWS[w.id].base);
  const place = placeOf(business);

  return (
    <>
      <PageHeader
        title="Workflows"
        actions={
          <ButtonLink href={businessHref(business.id, "stack")} variant="secondary">
            See your stack
          </ButtonLink>
        }
      />
      <section className="slip wf-order" aria-labelledby="order-title">
        <header className="slip-head">
          <h2 id="order-title">Work order for {business.name}</h2>
          {place !== null && <span>{place}</span>}
        </header>
        <div className="slip-perf" aria-hidden="true" />
        <Group business={business} label="Shared by every business" list={shared} choices={choices} />
        {added.length > 0 && <Group business={business} label="Added from your answers" list={added} choices={choices} />}
      </section>
      <OpenFromHash />
    </>
  );
}
