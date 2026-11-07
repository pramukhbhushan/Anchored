import type { Metadata } from "next";
import Link from "next/link";
import { OppCard } from "@/components/OppCard";
import { businessHref } from "@/components/routes";
import { Stamp } from "@/components/Stamp";
import { plannedWorkflows, type PlannedWorkflow } from "@/components/view-helpers";
import { PATH_DESCRIPTION, WORKFLOWS } from "@/lib/domain/workflows";
import type { PathKind } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Step 2, the workflows map: a legend of the four stamps, then one card per
// workflow, the five shared ones first and the ones onboarding added after.

export const metadata: Metadata = { title: "Your workflows" };

const LEGEND: readonly PathKind[] = ["turnon", "buy", "build", "skip"];

/** Render every workflow card for the business in the URL, grouped shared then added. */
export default async function WorkflowsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const choices = await getChoices(business);
  const planned = plannedWorkflows(business);
  const shared = planned.filter((w) => WORKFLOWS[w.id].base);
  const added = planned.filter((w) => !WORKFLOWS[w.id].base);

  const grid = (list: readonly PlannedWorkflow[]) => (
    <div className="mapgrid">
      {list.map((w) => (
        <OppCard key={w.id} business={business} id={w.id} plan={w.plan} choice={choices[w.id]} />
      ))}
    </div>
  );

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Your workflows</h2>
          <p>
            Workflows are the work AI can take on. Each one has three paths, and the stamp shows our pick. Choose a
            different path any time; your stack updates as you go.
          </p>
        </div>
        <Link className="btn" href={businessHref(business.id, "stack")}>
          See your stack
        </Link>
      </div>
      <div className="legend">
        {LEGEND.map((path) => (
          <span key={path}>
            <Stamp path={path} /> {PATH_DESCRIPTION[path]}
          </span>
        ))}
      </div>
      <div className="grouphead">
        <h3>The five every business shares</h3>
        <p>From the most common uses of AI for small business</p>
      </div>
      {grid(shared)}
      {added.length > 0 && (
        <>
          <div className="grouphead">
            <h3>Added for {business.name}</h3>
            <p>From your onboarding answers</p>
          </div>
          {grid(added)}
        </>
      )}
    </>
  );
}
