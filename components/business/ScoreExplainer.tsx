import { CheckDot } from "@/components/business/CheckGrid";
import { FIT_FAIR_FROM, FIT_GOOD_FROM } from "@/components/business/tool-visuals";
import styles from "@/components/business/visuals.module.css";
import { CHECKS, STATUS_LABEL } from "@/lib/domain/rating";
import type { CheckStatus } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// "How we score": the short explainer behind every fit score, so "63" beside
// "3 verified" doesn't read as a contradiction, with a key to the check dots.
// It sits under the tools page's title. The weights it describes live in
// `lib/domain/rating.ts`.

const DOT_ORDER: readonly CheckStatus[] = ["met", "partly", "unknown", "no"];

/** Render the collapsible "How we score" note, linkable at `#how-we-score`. */
export function ScoreExplainer() {
  return (
    <details className="explainer" id="how-we-score">
      <summary>How we score</summary>
      <div className="explainer-body">
        <p>
          Every tool gets a fit score out of 100 from {CHECKS.length} checks, worked out in code for your business.
          Checks that matter more, such as connecting to the software you use, weigh more. The ring turns green from{" "}
          {FIT_GOOD_FROM} and orange below {FIT_FAIR_FROM}.
        </p>
        <p>
          A check that&apos;s met counts in full, partly met counts half, and not met counts zero. A check we
          haven&apos;t verified yet counts for a little, not zero, so a tool isn&apos;t sunk because a vendor page was
          missing. That&apos;s why a tool can score in the 60s with only a few checks verified.
        </p>
        <ul className={styles.key} aria-label="What the dots mean">
          {DOT_ORDER.map((status) => (
            <li key={status}>
              <CheckDot status={status} />
              {STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
