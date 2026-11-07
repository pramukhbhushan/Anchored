import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CHECKS, EVIDENCE_LABEL, STATUS_LABEL } from "@/lib/domain/rating";
import type { CheckStatus, Rating } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The seven checks for one tool: each check, its status pill, and the reason
// with its evidence level. `StatusBadge` is the pill on its own, shared with
// the side-by-side comparison. Plain markup, safe in server and client components.

const STATUS_TONE: Readonly<Record<CheckStatus, BadgeTone>> = {
  met: "good",
  partly: "new",
  unknown: "neutral",
  no: "warn",
};

/** Render one check status as a pill. */
export function StatusBadge({ status }: { readonly status: CheckStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Render every check in `rating` with its status, reason and evidence. */
export function CheckGrid({ rating }: { readonly rating: Rating }) {
  return (
    <ul className="crit">
      {CHECKS.map(({ key, label }) => {
        const [status, evidence, note] = rating.checks[key];
        return (
          <li key={key}>
            <span className="crit-name">{label}</span>
            <StatusBadge status={status} />
            <span className="crit-note">
              {note}. <i>{EVIDENCE_LABEL[evidence]}</i>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
