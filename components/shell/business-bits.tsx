// =============================================================================
// Module Overview
// =============================================================================
// The two pieces the sidebar and the business switcher both draw for each
// business: the initial on its tile and its count of approvals waiting.

/** Return the first letter of `name`, upper-cased, for its tile. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

/** Render a count of approvals waiting, read as ", 3 waiting" by screen readers; nothing when there are none. */
export function WaitingCount({ value, className }: { readonly value: number | null; readonly className: string }) {
  if (value === null || value === 0) return null;
  return (
    <span className={className}>
      <span className="sr">, </span>
      {value}
      <span className="sr"> waiting</span>
    </span>
  );
}
