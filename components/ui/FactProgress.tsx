"use client";

import { Progress } from "radix-ui";
import styles from "./inspection.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// A shadcn Progress composition reports actual facts reviewed during setup.
// Skipped facts count as reviewed, never as facts Anchored learned.

/** Report the count of reviewed business facts without guessing completion. */
export function FactProgress({
  reviewed,
  total,
}: {
  readonly reviewed: number;
  readonly total: number;
}) {
  if (total === 0) return null;
  const value = Math.min(total, Math.max(0, reviewed));
  return (
    <Progress.Root
      className={styles.progress}
      value={value}
      max={total}
      aria-label="Business facts reviewed"
      getValueLabel={() => `${value} of ${total} reviewed`}
    >
      <Progress.Indicator
        className={styles.indicator}
        style={{ transform: `translateX(-${100 - (value / total) * 100}%)` }}
      />
    </Progress.Root>
  );
}
