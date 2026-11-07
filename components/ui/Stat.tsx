import type { ReactNode } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// `Stat` and `StatStrip`: the KPI row. The strip is one ruled sheet split into
// equal cells rather than a row of separate cards, so the numbers read as one
// line of the same report.

/** Render one number with its label and an optional line of context. */
export function Stat({
  label,
  value,
  hint,
}: {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
}) {
  return (
    <div className="stats-cell">
      <dt>{label}</dt>
      <dd>
        <b>{value}</b>
        {hint !== undefined && <span>{hint}</span>}
      </dd>
    </div>
  );
}

/** Render a row of `Stat`s as one ruled strip. */
export function StatStrip({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <dl className="stats" aria-label={label}>
      {children}
    </dl>
  );
}
