import type { Metadata } from "next";
import { OpenFromHash } from "@/components/business/OpenFromHash";
import { automationHref, businessHref, toolsHref } from "@/components/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { changeOptions, workflowFlow, type HandlerKind } from "@/components/workflows/flow";
import { PlanBand } from "@/components/workflows/PlanBand";
import { automationSummary, automationsOf } from "@/components/workflows/automations";
import { WorkflowGraph, type GraphStage } from "@/components/workflows/WorkflowGraph";
import { WorkflowMap, type MapStage } from "@/components/workflows/WorkflowMap";
import { isSampleBusinessId } from "@/lib/domain/cases";
import { stackCost, workflowIdsOf } from "@/lib/domain/paths";
import { planStatus } from "@/lib/domain/plan";
import { groupByStage } from "@/lib/domain/stages";
import { WORKFLOWS } from "@/lib/domain/workflows";
import { getBusinessOrNotFound, getChoices, getFeed, getSavedChoices } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The Workflows page: Anchored's plan for the business and where it stands
// with the owner, then a map of how the business runs day to day: the
// business in the middle, its stages, jobs and automations one level at a
// time, each automation linking to its own page. Under the map, the same jobs
// as a list, each drawn from what starts it to what the owner gets.
// `#wf-<id>` links land on one workflow in the list.

export const metadata: Metadata = { title: "Workflows" };

/** Render the plan and the graph for the business in the URL. */
export default async function WorkflowsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, saved, feed] = await Promise.all([getChoices(business), getSavedChoices(business), getFeed(business)]);
  const pending = feed.cards.filter((card) => card.status === "pending");
  const status = planStatus(business, saved);
  const changed = status.kind === "changed" ? status.changed : [];

  const stages: GraphStage[] = groupByStage(workflowIdsOf(business)).map(({ stage, workflows }) => ({
    stage,
    jobs: workflows.map((workflow) => ({
      flow: workflowFlow(business, choices, workflow),
      options: changeOptions(business, choices, workflow),
      changed: changed.includes(workflow),
      isNew: business.workflows[workflow]?.isNew ?? false,
    })),
  }));
  const map: MapStage[] = stages.map(({ stage, jobs }) => ({
    id: stage.id,
    name: stage.name,
    blurb: stage.blurb,
    jobs: jobs.map(({ flow }) => ({
      id: flow.id,
      name: flow.name,
      kind: flow.handler.kind,
      handler: flow.handler.name,
      note: flow.handler.note,
      automations: automationsOf(flow, stage).map((a) => ({
        key: a.key,
        name: a.name,
        summary: automationSummary(a),
        handler: a.kind === "none" ? "Nobody yet" : `${a.handler}. ${a.note}`,
        result: a.result,
        waiting: pending.filter((card) => card.skill === a.key).length,
        href: automationHref(business.id, a.workflow, a.key),
      })),
    })),
  }));
  const counts: Record<HandlerKind, number> = { agent: 0, owned: 0, new: 0, none: 0 };
  for (const job of stages.flatMap((s) => s.jobs)) counts[job.flow.handler.kind] += 1;
  // The banner names changes in the order the graph shows them.
  const changedNames = stages.flatMap((s) => s.jobs).filter((job) => job.changed).map((job) => WORKFLOWS[job.flow.id].name);

  return (
    <>
      <PageHeader title="Workflows" description={`How ${business.name} runs day to day, and who handles each job.`} />
      <PlanBand
        businessId={business.id}
        businessName={business.name}
        status={status}
        changedNames={changedNames}
        counts={counts}
        cost={stackCost(business, choices)}
        stackHref={businessHref(business.id, "stack")}
        canApprove={!isSampleBusinessId(business.id)}
      />
      <WorkflowMap businessName={business.name} stages={map} />
      <details className="wf-list">
        <summary>See every job as a list, step by step</summary>
        <WorkflowGraph
          businessId={business.id}
          businessName={business.name}
          stages={stages}
          toolsHref={(workflow) => toolsHref(business.id, workflow)}
        />
      </details>
      <OpenFromHash />
    </>
  );
}
