import { Fragment } from "react";
import { CHECKS, EVIDENCE_LABEL, STATUS_LABEL } from "@/lib/domain/rating";
import type { Rating } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The seven checks for one tool as a three-column grid: the check, its status
// pill, and the reason with its evidence level. Plain markup, safe in server
// and client components.

/** Render every check in `rating` with its status, reason and evidence. */
export function CheckGrid({ rating }: { readonly rating: Rating }) {
  return (
    <div className="crit">
      {CHECKS.map(({ key, label }) => {
        const [status, evidence, note] = rating.checks[key];
        return (
          <Fragment key={key}>
            <span>{label}</span>
            <span className={`st ${status}`}>{STATUS_LABEL[status]}</span>
            <span className="ev">
              {note}. <i>{EVIDENCE_LABEL[evidence]}</i>
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
