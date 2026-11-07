import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// URL builders for the product under `/app`, so every link and `router.push`
// spells `/app/b/<id>/<section>` the same way. `SECTIONS` lists the business
// pages in sidebar order; `sectionOf` narrows a URL segment to one of them.

/** A sub-page of `/app/b/[id]`. The overview at `/app/b/[id]` itself is written `null`. */
export type Section = "chat" | "workflows" | "tools" | "approvals" | "stack" | "profile";

/** The business pages in sidebar order, with the label each one shows. */
export const SECTIONS: readonly { readonly section: Section | null; readonly label: string }[] = [
  { section: null, label: "Overview" },
  { section: "chat", label: "Chat" },
  { section: "workflows", label: "Workflows" },
  { section: "tools", label: "Tools" },
  { section: "approvals", label: "Approvals" },
  { section: "stack", label: "Stack" },
  { section: "profile", label: "Profile" },
];

/** The list of businesses and the case studies. */
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
