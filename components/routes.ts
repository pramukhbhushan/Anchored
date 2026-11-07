import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// URL builders for the business pages, so every link and `router.push` spells
// `/b/<id>/<step>` the same way. `STEPS` drives the step tabs, and `DEMO_HREF`
// is where "Try it" lands.

/** A sub-page of `/b/[id]`. The profile at `/b/[id]` itself has no step and is written `null`. */
export type Step = "workflows" | "compare" | "stack" | "agents";

/** The five step tabs, in order, with the URL segment each one lives at. */
export const STEPS: readonly { readonly step: Step | null; readonly label: string }[] = [
  { step: null, label: "Your business" },
  { step: "workflows", label: "Your workflows" },
  { step: "compare", label: "Compare tools" },
  { step: "stack", label: "Your stack" },
  { step: "agents", label: "Agents at work" },
];

/** Return the URL of one business page, or of its profile when `step` is `null` or omitted. */
export function businessHref(id: string, step: Step | null = null): string {
  const base = `/b/${encodeURIComponent(id)}`;
  return step === null ? base : `${base}/${step}`;
}

/** Return the compare page URL, filtered to one workflow when `workflow` is given. */
export function compareHref(id: string, workflow?: WorkflowId): string {
  const base = businessHref(id, "compare");
  return workflow === undefined ? base : `${base}?workflow=${workflow}`;
}

// The build contract fixes the case-study ids, and the prototype opened on HVAC.
/** Where "Try it" and "Open the prototype" go: the HVAC case study's profile. */
export const DEMO_HREF = businessHref("hvac");
