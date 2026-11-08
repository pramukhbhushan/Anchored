import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// URL builders for the product under `/app`, so every link and `router.push`
// spells `/app/b/<id>/<section>` the same way. `SECTIONS` lists the business
// pages in sidebar order; `sectionOf` narrows a URL segment to one of them.

/** A sub-page of `/app/b/[id]`. The overview at `/app/b/[id]` itself is written `null`. */
export type Section = "chat" | "workflows" | "tools" | "approvals" | "connections" | "stack" | "profile";

/** The business pages in sidebar order, with the label each one shows. */
export const SECTIONS: readonly { readonly section: Section | null; readonly label: string }[] = [
  { section: null, label: "Overview" },
  { section: "chat", label: "Chat" },
  { section: "workflows", label: "Workflows" },
  { section: "tools", label: "Tools" },
  { section: "approvals", label: "Approvals" },
  { section: "connections", label: "Connections" },
  { section: "stack", label: "Stack" },
  { section: "profile", label: "Profile" },
];

/** The list of the viewer's businesses and the example. */
export const APP_HREF = "/app";

/** Chat onboarding for a new business. */
export const NEW_BUSINESS_HREF = "/app/new";

/** Narrow a URL segment to a `Section`, or `null` for the overview and anything unknown. */
export function sectionOf(segment: string | null | undefined): Section | null {
  return SECTIONS.find(({ section }) => section !== null && section === segment)?.section ?? null;
}

/** Return the URL of one business page, or of its overview when `section` is `null` or omitted. */
export function businessHref(id: string, section: Section | null = null): string {
  const base = `${APP_HREF}/b/${encodeURIComponent(id)}`;
  return section === null ? base : `${base}/${section}`;
}

/** Return the tools page URL, filtered to one workflow when `workflow` is given. */
export function toolsHref(id: string, workflow?: WorkflowId): string {
  const base = businessHref(id, "tools");
  return workflow === undefined ? base : `${base}?workflow=${workflow}`;
}

/** Return the element id of a card on the approvals page, built from its stable `key` so links survive a decision. */
export function cardAnchor(key: string): string {
  // Keys hold colons, such as "restaurant:posts"; a plain id needs no escaping in a URL or a selector.
  return `card-${key.replace(/[^\w-]/g, "-")}`;
}

/** Return an agent workspace URL, under Workflows. */
export function agentHref(id: string, agent: string): string {
  return `${businessHref(id, "workflows")}/${encodeURIComponent(agent)}`;
}

/** Return the URL of one automation's page: a step of workflow `workflow`, named by its route `key`. */
export function automationHref(id: string, workflow: WorkflowId, key: string): string {
  return `${businessHref(id, "workflows")}/${workflow}/${encodeURIComponent(key)}`;
}
