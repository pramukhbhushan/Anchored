import type { Metadata } from "next";
import { CompareBoard, type CompareItem } from "@/components/business/CompareBoard";
import { businessHref } from "@/components/routes";
import { ScoreExplainer } from "@/components/business/ScoreExplainer";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkflowFilter } from "@/components/business/WorkflowFilter";
import { DISCOVERY_QUEUE, TOOLS, fitsTrade, toolName } from "@/lib/domain/catalog";
import { workflowIdsOf } from "@/lib/domain/paths";
import { rateTool, usesSoftware } from "@/lib/domain/rating";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { Choice, Tool, WorkflowId } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The tools page: every catalog tool that covers one of the business's
// workflows, rated on the seven checks for this business and filtered by
// `?workflow=`. Tools built for other kinds of business wait behind a toggle.
// The discovery queue of unchecked listings for the same workflows sits below.

export const metadata: Metadata = { title: "Tools" };

/** Return the workflows the owner already turned on or bought `tool` for. */
function chosenFor(tool: Tool, workflows: readonly WorkflowId[], choices: Record<WorkflowId, Choice>): WorkflowId[] {
  return workflows.filter((w) => {
    const choice = choices[w];
    return (choice.path === "turnon" || choice.path === "buy") && choice.toolId === tool.id;
  });
}

/** Render the filter, the rated tools and the discovery queue for the business in the URL. */
export default async function ToolsPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const business = await getBusinessOrNotFound(id);
  const choices = await getChoices(business);
  const myWorkflows = workflowIdsOf(business);
  // An unknown or foreign workflow in the URL falls back to "all".
  const filter: WorkflowId | "all" = myWorkflows.find((w) => w === query.workflow) ?? "all";

  const items: CompareItem[] = TOOLS.flatMap((tool) => {
    const workflows = tool.workflows.filter((w) => myWorkflows.includes(w));
    if (workflows.length === 0) return [];
    const owned = tool.platform !== undefined && !tool.addon && usesSoftware(business, tool.platform);
    return [
      {
        tool,
        name: toolName(tool),
        rating: rateTool(tool, business),
        owned,
        chosenFor: chosenFor(tool, workflows, choices),
        // A tool the owner already pays for is relevant whatever trade it was built for.
        forThisBusiness: owned || fitsTrade(tool, business.tradeKey),
        workflows,
      },
    ];
  }).sort((a, z) => z.rating.total - a.rating.total);

  const queue = DISCOVERY_QUEUE.filter(
    (listing) => myWorkflows.includes(listing.workflow) && (filter === "all" || listing.workflow === filter),
  );

  return (
    <>
      <PageHeader
        title="Tools"
        description="Tools rated for this business on seven checks: price, setup, your software, data use, control, languages and track record. Code computes every score. Anchored doesn't score its own agents."
        actions={
          <ButtonLink href={businessHref(business.id, "stack")} variant="secondary">
            See your stack
          </ButtonLink>
        }
      />
      <WorkflowFilter businessId={business.id} workflows={myWorkflows} active={filter} />
      <ScoreExplainer />
      <CompareBoard key={business.id} businessId={business.id} items={items} filter={filter} />

      <Card
        className="section"
        title="Discovery queue"
        description="New tools a discovery agent found for your workflows. Nothing gets a score until a person opens the vendor's page and checks price, contract and data terms."
      >
        {queue.length === 0 ? (
          <p className="muted">Nothing is waiting for review for {filter === "all" ? "your workflows" : "this workflow"}.</p>
        ) : (
          <div className="queue">
            {queue.map((listing) => (
              <article key={listing.name}>
                <header>
                  <b>{listing.name}</b>
                  <Badge tone="warn">Waiting for review</Badge>
                </header>
                <p className="fine">{WORKFLOWS[listing.workflow].name}</p>
                <dl>
                  <dt>Price</dt>
                  <dd>{listing.price}</dd>
                  <dt>Connects</dt>
                  <dd>{listing.connects}</dd>
                  <dt>Data terms</dt>
                  <dd>{listing.data}</dd>
                  <dt>Contract</dt>
                  <dd>{listing.contract}</dd>
                  <dt>Source</dt>
                  <dd>{listing.source}</dd>
                  <dt>Found</dt>
                  <dd>{listing.foundOn}</dd>
                </dl>
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
