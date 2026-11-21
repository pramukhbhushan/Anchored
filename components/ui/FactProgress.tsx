"use client";

import { Progress } from "radix-ui";
import styles from "./inspection.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The onboarding progress bar: how many business facts the owner has reviewed
// out of the total. A skipped fact counts as reviewed, not as one Anchored
// learned. Built on the Radix progress primitive.

/** Render a bar of `reviewed` out of `total` facts, or nothing when there are no facts. */
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
