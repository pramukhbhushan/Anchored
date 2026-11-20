import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The stages of a business's day that the Workflows graph lays its workflows
// in: getting customers, serving them, then getting paid and running the shop.
// `WORKFLOW_STAGE` is the one place a workflow is given a stage; `stageOf`
// reads it with a fallback, and `groupByStage` lays a business's workflows out.

/** A stage of the day, in the owner's words. */
export interface Stage {
  readonly id: StageId;
  readonly name: string;
  /** One line under the stage's name on the graph. */
  readonly blurb: string;
}

export type StageId = "customers" | "serving" | "running";

/** A stage and the business's workflows in it, in workflow order. */
interface StageGroup {
  readonly stage: Stage;
  readonly workflows: readonly WorkflowId[];
}

const STAGE: Readonly<Record<StageId, Stage>> = {
  customers: { id: "customers", name: "Getting customers", blurb: "How people find you, hear back and come again" },
  serving: { id: "serving", name: "Serving customers", blurb: "Calls, bookings, orders and quotes" },
  running: { id: "running", name: "Getting paid and running the shop", blurb: "Money in, bills out, staff and paperwork" },
};

/** The stages in the order a customer meets them. */
export const STAGES: readonly Stage[] = [STAGE.customers, STAGE.serving, STAGE.running];

/** The stage each workflow belongs to. Exhaustive, so a new workflow fails `tsc` until it has one. */
const WORKFLOW_STAGE: Readonly<Record<WorkflowId, StageId>> = {
  leads: "customers",
  social: "customers",
  reviews: "customers",
  referrals: "customers",
  calls: "serving",
  noshows: "serving",
  catering: "serving",
  quotes: "serving",
  books: "running",
  invoices: "running",
  disputes: "running",
  scheduling: "running",
  snap: "running",
  licenses: "running",
  memberships: "running",
};

const FALLBACK_STAGE: StageId = "running";

/** Return the stage for `id`; an id saved before a rename lands in the last stage. */
export function stageOf(id: WorkflowId): Stage {
  // Saved plans are read back from the store, so an id can outlive its entry here.
  return STAGE[WORKFLOW_STAGE[id] ?? FALLBACK_STAGE];
}

/** Group `ids` by stage, in stage order, keeping the order of `ids` inside each and leaving out empty stages. */
export function groupByStage(ids: readonly WorkflowId[]): StageGroup[] {
  return STAGES.map((stage) => ({ stage, workflows: ids.filter((id) => stageOf(id).id === stage.id) })).filter(
    (group) => group.workflows.length > 0,
  );
}
