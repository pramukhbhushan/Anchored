import type { Metadata } from "next";
import Link from "next/link";
import { CompareBoard, type CompareItem } from "@/components/CompareBoard";
import { businessHref } from "@/components/routes";
import { WorkflowFilter } from "@/components/WorkflowFilter";
import { DISCOVERY_QUEUE, TOOLS, toolName } from "@/lib/domain/catalog";
import { chosenTools, workflowIdsOf } from "@/lib/domain/paths";
import { rateTool, usesSoftware } from "@/lib/domain/rating";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { WorkflowId } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Step 3, compare tools: every catalog tool that covers one of the business's
// workflows, rated on the seven checks for this business, filtered by
// `?workflow=`, with the discovery queue of unchecked listings underneath.

export const metadata: Metadata = { title: "Compare tools" };

/** Render the filter, the rated tools and the discovery queue for the business in the URL. */
export default async function ComparePage({
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
  // An unknown or foreign workflow in the URL falls back to "all", as the prototype reset it.
  const filter: WorkflowId | "all" = myWorkflows.find((w) => w === query.workflow) ?? "all";
  const inStack = new Set(chosenTools(business, choices).map((x) => x.tool.id));

  const items: CompareItem[] = TOOLS.flatMap((tool) => {
    const workflows = tool.workflows.filter((w) => myWorkflows.includes(w));
    if (workflows.length === 0) return [];
    return [
      {
        tool,
        name: toolName(tool),
        rating: rateTool(tool, business),
        owned: tool.platform !== undefined && !tool.addon && usesSoftware(business, tool.platform),
        inStack: inStack.has(tool.id),
        workflows,
      },
    ];
  }).sort((a, z) => z.rating.total - a.rating.total);

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Compare tools, rated for {business.name}</h2>
          <p>
            Star ratings can&apos;t say whether a tool works with your POS, names your languages or keeps you in charge.
            Anchored rates every tool on seven checks, personalized by your onboarding, and shows how sure it is of each
            one. Code computes the score. Anchored doesn&apos;t score its own agents.
          </p>
        </div>
        <Link className="btn" href={businessHref(business.id, "stack")}>
          See your stack
        </Link>
      </div>
      <WorkflowFilter businessId={business.id} workflows={myWorkflows} active={filter} />
      <CompareBoard key={business.id} businessId={business.id} items={items} filter={filter} />
      <div className="panel" style={{ marginTop: 22 }}>
        <h3>Discovery queue</h3>
        <p className="small" style={{ marginTop: 4, color: "var(--ink-2)" }}>
          A discovery agent searches for new tools for every workflow each week. It records price, integrations, data
          terms, contract, source and date. Nothing gets a score until a person opens the vendor&apos;s page and checks
          it.
        </p>
        <div className="queue">
          {DISCOVERY_QUEUE.map((listing) => (
            <article key={listing.name}>
              <b>{listing.name}</b>{" "}
              <span className="chip" style={{ marginLeft: 4 }}>
                {WORKFLOWS[listing.workflow].name}
              </span>
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
              <p className="tiny" style={{ marginTop: 8 }}>
                <span className="chip warn">Waiting for review</span>
              </p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
