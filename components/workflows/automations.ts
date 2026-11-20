import { AUTOMATION_NAMES } from "@/components/workflows/copy";
import { lowerFirst, type HandlerKind, type WorkflowFlow } from "@/components/workflows/flow";
import type { Stage } from "@/lib/domain/stages";
import type { SkillId, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The automations inside each workflow, for the Workflows map, the sidebar and
// each automation's own page. An automation is one route of a workflow's flow:
// an agent job when Anchored drafts the work, or the tool's one job otherwise,
// told with the name, trigger and result an owner would use.

/** One automation: what starts it, who does it and what the owner gets. */
export interface Automation {
  /** The route key: a skill id for Anchored's work, the workflow id for a tool's or nobody's. */
  readonly key: string;
  readonly workflow: WorkflowId;
  readonly workflowName: string;
  readonly stage: Stage;
  readonly name: string;
  readonly kind: HandlerKind;
  /** Who does it, in a few words: "Anchored drafts it", "Your OpenTable", "Not handled yet". */
  readonly handler: string;
  /** The line under the handler: "Front Desk agent, in your $29 plan". */
  readonly note: string;
  readonly trigger: string;
  /** What Anchored drafts for the owner's OK, or `null` when nothing waits for them. */
  readonly draft: string | null;
  /** For a tool, who decides what it does; `null` otherwise. */
  readonly rule: string | null;
  /** What the owner gets, or `null` while nobody does the work. */
  readonly result: string | null;
}

/** Report whether `key` names an agent job, which has its own name. */
function isSkill(key: string): key is SkillId {
  return Object.hasOwn(AUTOMATION_NAMES, key);
}

/** List the automations in `flow`, a workflow in `stage`, in route order. */
export function automationsOf(flow: WorkflowFlow, stage: Stage): Automation[] {
  return flow.routes.map((route) => ({
    key: route.key,
    workflow: flow.id,
    workflowName: flow.name,
    stage,
    name: isSkill(route.key) ? AUTOMATION_NAMES[route.key] : flow.name,
    kind: flow.handler.kind,
    handler: flow.handler.name,
    note: flow.handler.note,
    trigger: route.trigger,
    draft: route.draft,
    rule: route.rule,
    result: route.result,
  }));
}

/** Say in one sentence what automation `a` does, for its overview and its page. */
export function automationSummary(a: Automation): string {
  const when = lowerFirst(a.trigger);
  if (a.draft !== null) return `When ${when}, Anchored writes ${lowerFirst(a.draft)}. Nothing is sent until you approve it.`;
  if (a.kind === "none") return `Nobody does this yet. When ${when}, you handle it yourself for now.`;
  return `When ${when}, ${a.handler} does the work${a.rule === null ? "" : `. ${a.rule.replace(/\.$/, "")}`}.`;
}
