import styles from "@/components/business/visuals.module.css";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CHECKS, EVIDENCE_LABEL, STATUS_LABEL } from "@/lib/domain/rating";
import type { CheckStatus, Rating } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The seven checks for one tool. `CheckDot` is one check as a dot whose shape
// and color say its status; `CheckDots` is a tool's row of seven; `CheckGrid`
// lists each check with its dot, status and reason. `StatusBadge` is the pill
// the side-by-side comparison uses. Plain markup, safe in server and client components.

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

/** Render one check as a dot: filled when met, half when partly, hollow when not known, an orange diamond when not met. */
export function CheckDot({ status, title }: { readonly status: CheckStatus; readonly title?: string }) {
  return <span className={styles.dot} data-status={status} title={title} aria-hidden="true" />;
}

/** Render the seven dots for `rating`, in the checks' order; the caller gives the text equivalent. */
export function CheckDots({ rating }: { readonly rating: Rating }) {
  return (
    <span className={styles.dots} aria-hidden="true">
      {CHECKS.map(({ key, label }) => {
        const [status] = rating.checks[key];
        return <CheckDot key={key} status={status} title={`${label}: ${STATUS_LABEL[status]}`} />;
      })}
    </span>
  );
}

/** Render every check in `rating` with its dot, status, reason and evidence. */
export function CheckGrid({ rating }: { readonly rating: Rating }) {
  return (
    <ul className={styles.checks}>
      {CHECKS.map(({ key, label }) => {
        const [status, evidence, note] = rating.checks[key];
        return (
          <li key={key} className={styles.check}>
            <CheckDot status={status} />
            <span className={styles.checkName}>{label}</span>
            <span className={styles.checkStatus} data-status={status}>
              {STATUS_LABEL[status]}
            </span>
            <span className={styles.checkNote}>
              {note}. <i>{EVIDENCE_LABEL[evidence]}</i>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
