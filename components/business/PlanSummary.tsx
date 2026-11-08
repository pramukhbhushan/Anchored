import Link from "next/link";
import styles from "@/components/business/workflows.module.css";
import { money } from "@/components/view-helpers";
import type { Choice, PathKind, StackCost } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The plan at a glance, above the Workflows page's work order: one bar split by
// how each workflow gets done, in the stamps' colors, a count for each path in
// words, and what the plan costs a month with a link to the Stack page. The
// bar is drawn for the eye; the counts beside it say the same in text.

/** The paths in the order the bar draws them: Anchored's agents first, skipped work last. */
const ORDER: readonly PathKind[] = ["build", "buy", "turnon", "skip"];

/** How each count reads after its number, such as "4 built by Anchored's agents". */
const COUNT_LABEL: Readonly<Record<PathKind, string>> = {
  build: "built by Anchored's agents",
  buy: "bought",
  turnon: "turned on, already yours",
  skip: "skipped for now",
};

/** Return how many workflows sit on each path. */
export function countPaths(choices: readonly Choice[]): Record<PathKind, number> {
  const counts: Record<PathKind, number> = { build: 0, buy: 0, turnon: 0, skip: 0 };
  for (const choice of choices) counts[choice.path] += 1;
  return counts;
}

/** Render the bar, the count for each path that has any, and the monthly cost linking to `stackHref`. */
export function PlanSummary({
  counts,
  cost,
  stackHref,
}: {
  readonly counts: Readonly<Record<PathKind, number>>;
  readonly cost: StackCost;
  readonly stackHref: string;
}) {
  const shown = ORDER.filter((path) => counts[path] > 0);
  const onQuote = cost.onQuote.length;
  return (
    <section className={styles.plan} aria-labelledby="plan-title">
      <h2 id="plan-title" className="sr">
        Your plan at a glance
      </h2>
      <div className={styles.planMain}>
        <div className={styles.bar} aria-hidden="true">
          {shown.map((path) => (
            // Counts drive flex-grow directly, so each segment's width is its share of the workflows
            <span key={path} className={styles.seg} data-path={path} style={{ flexGrow: counts[path] }} />
          ))}
        </div>
        <ul className={styles.counts}>
          {shown.map((path) => (
            <li key={path} data-path={path}>
              <span className={styles.swatch} aria-hidden="true" />
              <b>{counts[path]}</b> {COUNT_LABEL[path]}
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.cost}>
        <b>{money(cost.total)}</b>
        <span>
          a month{onQuote > 0 && `, plus ${onQuote} on quote`}. <Link href={stackHref}>See your stack</Link>
        </span>
      </p>
    </section>
  );
}
