import type { ReactNode } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// `Badge`, the small pill for tags and statuses: a channel or tool on a
// profile, "New for you", a check's status, or a count in the sidebar.

/** `neutral` for plain tags, `new` for carbon highlights and counts waiting; the rest mark a status. */
export type BadgeTone = "neutral" | "new" | "good" | "warn" | "info";

/** Render a pill with `tone`. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  readonly tone?: BadgeTone;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return <span className={`badge badge-${tone}${className ? ` ${className}` : ""}`}>{children}</span>;
}
