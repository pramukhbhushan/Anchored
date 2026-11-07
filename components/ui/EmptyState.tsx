import type { ReactNode } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// `EmptyState`: what a list shows when it has nothing in it yet. It says what
// will appear here and offers the action that fills it.

/** Render an empty list's icon, title, one line of direction and its actions. */
export function EmptyState({
  icon,
  title,
  children,
  actions,
}: {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon !== undefined && (
        <span className="empty-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h2 className="empty-title">{title}</h2>
      {children !== undefined && <p className="empty-text">{children}</p>}
      {actions !== undefined && <div className="empty-actions">{actions}</div>}
    </div>
  );
}
