import type { ReactNode } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// `PageHeader` opens every page in the app the same way: the page's one `h1`,
// an optional badge beside it, a line of description, and actions on the right
// that wrap below the title at phone width.

/** Render the page title row; `compact` puts the title and description on one line for pages that fill the window. */
export function PageHeader({
  title,
  badge,
  description,
  actions,
  compact = false,
}: {
  readonly title: ReactNode;
  readonly badge?: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly compact?: boolean;
}) {
  return (
    <header className={compact ? "page-head is-compact" : "page-head"}>
      <div className="page-head-text">
        <div className="page-title-row">
          <h1 className="page-title">{title}</h1>
          {badge}
        </div>
        {description !== undefined && <p className="page-desc">{description}</p>}
      </div>
      {actions !== undefined && <div className="page-actions">{actions}</div>}
    </header>
  );
}

/** Render a section heading inside a page: an `h2`, an optional line under it and an optional action. */
export function SectionHeader({
  title,
  description,
  action,
  id,
}: {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly id?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <h2 id={id}>{title}</h2>
        {description !== undefined && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
