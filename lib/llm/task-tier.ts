import type { ModelTier } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// One provider-neutral map from model task to capability tier. Provider
// adapters turn quick, default and complex into their configured model ids, so
// feature code never hardcodes an Anthropic, OpenAI or other vendor model.

/** Model-backed tasks Anchored may run. */
export type ModelTask =
  | "triage"
  | "short_reword"
  | "live_reply"
  | "draft"
  | "extraction"
  | "discovery"
  | "multi_step";

/** Capability tier for every model-backed task. */
export const TASK_TIER: Readonly<Record<ModelTask, ModelTier>> = {
  triage: "quick",
  short_reword: "quick",
  live_reply: "quick",
  draft: "default",
  extraction: "default",
  discovery: "complex",
  multi_step: "complex",
};

/** Return the provider-neutral model tier for `task`. */
export function tierForTask(task: ModelTask): ModelTier {
  return TASK_TIER[task];
}
