import type { ReactNode } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// `Card`, the one surface in the app: a white sheet with a hairline border.
// With a `title` it gets a header row holding the heading, an optional line
// of description and an optional action on the right.

/** Render a card as `as` (a `section` by default), with an optional header row. */
export function Card({
  as: Tag = "section",
  title,
  level = 2,
  description,
  action,
  className,
  id,
  children,
}: {
  readonly as?: "section" | "article" | "div" | "aside";
  readonly title?: ReactNode;
  /** Heading level for `title`; 3 when the card sits under a section heading. */
  readonly level?: 2 | 3;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly id?: string;
  readonly children?: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Tag className={`panel${className ? ` ${className}` : ""}`} id={id}>
      {title !== undefined && (
        <header className="panel-head">
          <div>
            <Heading className="panel-title">{title}</Heading>
            {description !== undefined && <p className="panel-desc">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
