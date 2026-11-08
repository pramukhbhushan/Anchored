import Link from "next/link";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { ApprovePlanButton } from "@/components/workflows/ApprovePlanButton";
import type { HandlerKind } from "@/components/workflows/flow";
import styles from "@/components/workflows/graph.module.css";
import { money } from "@/components/view-helpers";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import type { PlanStatus } from "@/lib/domain/plan";
import type { StackCost } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The top of the Workflows page: Anchored's plan waiting for the owner's yes,
// the plan live since the day they gave it, or the steps they changed since.
// A tally of who handles the work doubles as the key to the graph's colors.

/** The order the tally names handlers in, and how each count reads after its number. */
const TALLY: readonly (readonly [HandlerKind, (count: number) => string])[] = [
  ["agent", () => "drafted by Anchored for your OK"],
  ["owned", (n) => (n === 1 ? "runs on a tool you have" : "run on tools you have")],
  ["new", (n) => (n === 1 ? "needs a new tool" : "need new tools")],
  ["none", () => "not handled yet"],
];

/** Say `iso` as an owner reads a date, such as "Nov 6, 2026", in the owner's time zone. */
function dateText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: OWNER_TIME_ZONE });
}

/** Say what the owner still does for the tools in a live plan; Anchored can't sign them up or switch a feature on. */
function liveTools(counts: Readonly<Record<HandlerKind, number>>): string {
  const fresh = counts.new === 0 ? "" : counts.new === 1 ? " A new tool starts once you sign up for it." : " New tools start once you sign up for them.";
  const owned = counts.owned === 0 ? "" : " Tools you have do their part once the feature is on in them.";
  return fresh + owned;
}

/** Join names as "a", "a and b", or "a, b and c". */
function andList(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Render where the plan stands, the tally, its monthly cost and, when it waits on the owner, the approve button. */
export function PlanBand({
  businessId,
  businessName,
  status,
  changedNames,
  counts,
  cost,
  stackHref,
  canApprove,
}: {
  readonly businessId: string;
  readonly businessName: string;
  readonly status: PlanStatus;
  /** Names of the workflows the owner changed since approving, in graph order. */
  readonly changedNames: readonly string[];
  readonly counts: Readonly<Record<HandlerKind, number>>;
  readonly cost: StackCost;
  readonly stackHref: string;
  /** `false` for the example, whose approval lives in code. */
  readonly canApprove: boolean;
}) {
  const jobs = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const onQuote = cost.onQuote.length;
  return (
    <section className={styles.plan} data-state={status.kind} aria-labelledby="plan-title">
      <div className={styles.planText}>
        <h2 id="plan-title" className={styles.planTitle}>
          {status.kind === "draft" ? "Here's your plan" : status.kind === "live" ? "Your plan is live" : `You changed ${changedNames.length === 1 ? "a step" : `${changedNames.length} steps`}`}
        </h2>
        <p className={styles.planLead}>
          {status.kind === "draft" && `Anchored mapped ${jobs} ${jobs === 1 ? "job" : "jobs"} ${businessName} does day to day and picked who handles each one. Look it over, change any step, then approve it.`}
          {status.kind === "live" && `You approved it on ${dateText(status.approvedAt)}. Anchored's drafts wait for you in Approvals.${liveTools(counts)}`}
          {status.kind === "changed" &&
            (canApprove
              ? `${andList(changedNames)} changed since you approved the plan on ${dateText(status.approvedAt)}. Approve the changes to make them part of it.`
              : `${andList(changedNames)} changed since this example's plan was approved on ${dateText(status.approvedAt)}. The example keeps its approval.`)}
          {status.kind === "changed" && !canApprove && (
            <>
              {" "}
              <Link href={NEW_BUSINESS_HREF}>Set up your own business</Link> to approve a plan of your own.
            </>
          )}
        </p>
        <ul className={styles.tally} aria-label="Who handles the work">
          {TALLY.filter(([kind]) => counts[kind] > 0).map(([kind, words]) => (
            <li key={kind} data-kind={kind}>
              <span className={styles.swatch} aria-hidden="true" />
              <b>{counts[kind]}</b> {words(counts[kind])}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.planSide}>
        <p className={styles.cost}>
          <b>{money(cost.total)}</b>
          <span>
            a month{onQuote > 0 && `, plus ${onQuote} on quote`}. <Link href={stackHref}>See the bill</Link>
          </span>
        </p>
        {canApprove && status.kind !== "live" && (
          <ApprovePlanButton businessId={businessId} label={status.kind === "draft" ? "Approve this plan" : "Approve changes"} />
        )}
      </div>
    </section>
  );
}
