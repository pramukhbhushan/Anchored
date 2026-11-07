import type { ReactNode } from "react";
import { Stamp } from "@/components/Stamp";
import { plannedWorkflows, topWorkflows } from "@/components/view-helpers";
import { NOT_GIVEN, SIGNALS, WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The carbon-yellow work order from the landing hero: how Anchored read a
// business, its top four workflows with stamped verdicts, and an `action` slot
// in the footer for the "Open the full plan" button.

/** Render the work order for `business`, with `action` at the bottom right. */
export function WorkOrder({ business, action }: { readonly business: BusinessProfile; readonly action: ReactNode }) {
  const planned = plannedWorkflows(business);
  const actingCount = planned.filter((w) => w.plan.rec !== "skip").length;
  const top = topWorkflows(business, 4);
  const added = planned.filter((w) => !WORKFLOWS[w.id].base).map((w) => WORKFLOWS[w.id].name);
  const readAs = [
    ...business.reach.filter((r) => r !== NOT_GIVEN),
    ...business.signals.flatMap((id) => SIGNALS.find((s) => s.id === id)?.short ?? []),
  ];

  return (
    <div className="wo" aria-live="polite">
      <div className="wo-head">
        <b>Work order for {business.name}</b>
        <span>{business.place === NOT_GIVEN ? "" : business.place}</span>
      </div>
      <div className="wo-perf" aria-hidden="true" />
      <div className="wo-body">
        <dl className="wo-meta">
          <dt>Business</dt>
          <dd>{business.trade}</dd>
          <dt>Runs on</dt>
          <dd>{business.tools.join(", ")}</dd>
          {readAs.length > 0 && (
            <>
              <dt>We heard</dt>
              <dd>{readAs.join(", ")}</dd>
            </>
          )}
          <dt>Workflows</dt>
          <dd>5 shared{added.length > 0 ? `, plus ${added.join(", ")}` : ""}</dd>
        </dl>
        {top.map((w) => (
          <div className="wo-line" key={w.id}>
            <div>
              <b>{WORKFLOWS[w.id].name}</b>
              <p>{w.plan.why}</p>
            </div>
            <Stamp path={w.plan.rec} fresh />
          </div>
        ))}
        <div className="wo-foot">
          <span className="small muted">
            {actingCount} of {planned.length} workflows worth acting on
          </span>
          {action}
        </div>
      </div>
    </div>
  );
}
