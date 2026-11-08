import type { Metadata } from "next";
import { CompareBoard, type CompareItem } from "@/components/business/CompareBoard";
import { NewJobs } from "@/components/business/NewJobs";
import { OpenFromHash } from "@/components/business/OpenFromHash";
import { ScoreExplainer } from "@/components/business/ScoreExplainer";
import { WorkflowFilter } from "@/components/business/WorkflowFilter";
import { PageHeader } from "@/components/ui/PageHeader";
import { isSampleBusinessId } from "@/lib/domain/cases";
import { DISCOVERY_QUEUE, TOOLS, fitsTrade, toolName } from "@/lib/domain/catalog";
import { withArticle } from "@/lib/domain/discovery";
import { newJobs } from "@/lib/domain/new-jobs";
import { workflowIdsOf } from "@/lib/domain/paths";
import { rateTool, usesSoftware } from "@/lib/domain/rating";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { Choice, Tool, WorkflowId } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The tools page, where an owner discovers AI tools. Unfiltered, it leads with
// jobs onboarding didn't pick that a tool or Anchored could take on, each with
// a button to add it. Then every catalog tool that covers one of the business's
// workflows, rated on the seven checks for this business, ranked best fit
// first and filtered by `?workflow=`. Tools built for other kinds of business
// wait behind a toggle; listings the discovery agent found and no person has
// checked yet sit at the foot, unscored.

export const metadata: Metadata = { title: "Tools" };

/** Return the workflows the owner already turned on or bought `tool` for. */
function chosenFor(tool: Tool, workflows: readonly WorkflowId[], choices: Record<WorkflowId, Choice>): WorkflowId[] {
  return workflows.filter((w) => {
    const choice = choices[w];
    return (choice.path === "turnon" || choice.path === "buy") && choice.toolId === tool.id;
  });
}

/** Render the filter, the ranked tools and the listings waiting for review for the business in the URL. */
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
        title="Discover AI tools"
        description={
          <>
            <p>Rated for {business.name} on seven checks.</p>
            <ScoreExplainer />
          </>
        }
        actions={<WorkflowFilter businessId={business.id} workflows={myWorkflows} active={filter} />}
      />
      {filter === "all" && <NewJobs businessId={business.id} jobs={newJobs(business)} canAdd={!isSampleBusinessId(business.id)} />}

      <section className="section" aria-labelledby="your-jobs-title">
        <div className="section-head">
          <h2 id="your-jobs-title">Tools for the jobs you have</h2>
        </div>
        <CompareBoard key={business.id} businessId={business.id} items={items} filter={filter} />
      </section>

      {queue.length > 0 && (
        <details className="section queue" open>
          <summary>
            Just found: {queue.length} new {queue.length === 1 ? "tool" : "tools"} waiting for a person to check{" "}
            {queue.length === 1 ? "it" : "them"}
          </summary>
          <p className="queue-note">
            Our research and our discovery agent found these on the web. None gets a score until a person checks its
            price, contract and data terms.
          </p>
          <table className="rtable">
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Workflow</th>
                <th scope="col">Price</th>
                <th scope="col">Where we found it</th>
                <th scope="col">Found</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((listing) => (
                <tr key={listing.name}>
                  <th scope="row">{listing.name}</th>
                  <td data-label="Workflow">{WORKFLOWS[listing.workflow].name}</td>
                  <td data-label="Price">{listing.price}</td>
                  <td data-label="Where we found it">
                    {listing.url ? (
                      <a href={listing.url} target="_blank" rel="noopener noreferrer nofollow">
                        {listing.source}
                      </a>
                    ) : (
                      listing.source
                    )}
                  </td>
                  <td data-label="Found">
                    {listing.foundFor ? `${listing.foundOn}, for ${withArticle(listing.foundFor)}` : listing.foundOn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {/* A link to `#how-we-score` should open the explainer, not only scroll to its closed summary */}
      <OpenFromHash />
    </>
  );
}
