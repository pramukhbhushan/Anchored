import type { Metadata } from "next";
import Link from "next/link";
import { OppCard } from "@/components/business/OppCard";
import { businessHref } from "@/components/routes";
import { SampleBadge } from "@/components/business/SampleBadge";
import { Stamp } from "@/components/ui/Stamp";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { plannedWorkflows, type PlannedWorkflow } from "@/components/view-helpers";
import { PATH_DESCRIPTION, WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile, Choice, PathKind, WorkflowId } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The workflows map: what each stamp means, then one card per workflow, the
// five every business shares first and the ones onboarding added after. Each
// card offers three paths and marks the one the owner is on.

export const metadata: Metadata = { title: "Workflows" };

const LEGEND: readonly PathKind[] = ["turnon", "buy", "build", "skip"];

/** Render one group of workflow cards. */
function WorkflowGrid({
  business,
  list,
  choices,
}: {
  readonly business: BusinessProfile;
  readonly list: readonly PlannedWorkflow[];
  readonly choices: Record<WorkflowId, Choice>;
}) {
  return (
    <div className="grid-cards">
      {list.map((w) => (
        <OppCard key={w.id} business={business} id={w.id} plan={w.plan} choice={choices[w.id]} />
      ))}
    </div>
  );
}

/** Render every workflow card for the business in the URL, grouped shared then added. */
export default async function WorkflowsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const choices = await getChoices(business);
  const planned = plannedWorkflows(business);
  const shared = planned.filter((w) => WORKFLOWS[w.id].base);
  const added = planned.filter((w) => !WORKFLOWS[w.id].base);

  return (
    <>
      <PageHeader
        title="Workflows"
        badge={<SampleBadge business={business} />}
        description="Work AI can take on for this business. Each workflow has three paths. The stamp shows the one you're on; change it any time and your stack updates."
        actions={
          <ButtonLink href={businessHref(business.id, "stack")} variant="secondary">
            See your stack
          </ButtonLink>
        }
      />
      <div className="legend" role="note" aria-label="What the stamps mean">
        {LEGEND.map((path) => (
          <span key={path}>
            <Stamp path={path} /> {PATH_DESCRIPTION[path]}
          </span>
        ))}
        <span className="legend-score">
          Tool scores are out of 100.{" "}
          <Link href={`${businessHref(business.id, "tools")}#how-we-score`}>How we score</Link>
        </span>
      </div>

      <section className="section" aria-labelledby="shared">
        <SectionHeader
          id="shared"
          title="Every business shares these five"
          description="The most common places AI helps a small business."
        />
        <WorkflowGrid business={business} list={shared} choices={choices} />
      </section>
      {added.length > 0 && (
        <section className="section" aria-labelledby="added">
          <SectionHeader
            id="added"
            title={`Added for ${business.name}`}
            description="From what you told Anchored about how you work."
          />
          <WorkflowGrid business={business} list={added} choices={choices} />
        </section>
      )}
    </>
  );
}
