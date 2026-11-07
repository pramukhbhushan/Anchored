import { CHECKS } from "@/lib/domain/rating";

// =============================================================================
// Module Overview
// =============================================================================
// "How we score": the short explainer behind every fit score, so "63/100"
// beside "4 not known yet" doesn't read as a contradiction. The weights it
// describes live in `lib/domain/rating.ts`.

/** Render the collapsible "How we score" note, linkable at `#how-we-score`. */
export function ScoreExplainer() {
  return (
    <details className="explainer" id="how-we-score">
      <summary>How we score tools</summary>
      <div className="explainer-body">
        <p>
          Every tool gets a fit score out of 100 from {CHECKS.length} checks, worked out in code for your business.
          Checks that matter more, such as connecting to the software you use, weigh more.
        </p>
        <p>
          A check that&apos;s met counts in full, partly met counts half, and not met counts zero. A check we
          haven&apos;t verified yet counts for a little, not zero, so a tool isn&apos;t sunk because a vendor page was
          missing. That&apos;s why a tool can score in the 60s with only a few checks verified.
        </p>
      </div>
    </details>
  );
}
