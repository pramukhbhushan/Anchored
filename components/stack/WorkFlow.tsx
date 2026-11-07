import {
  CircleCheck,
  ConciergeBell,
  Megaphone,
  Newspaper,
  Plug,
  Receipt,
  Repeat,
  Sparkles,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { flowRows, type FlowHandler, type FlowLane, type FlowRoute } from "@/components/stack/flow";
import styles from "@/components/stack/stack.module.css";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import type { AgentRef, CoreAgentId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's flow diagram: each row follows one kind of work from what
// sets it off, to the agent or tool that picks it up, to the draft that waits
// for the owner's OK, to what the owner gets. It is real text in lists, so it
// is its own text equivalent; `flowRows` places it on the wide grid.

/** An icon for each core agent, picked for the work it does at the counter. */
const AGENT_ICON: Readonly<Record<CoreAgentId, LucideIcon>> = {
  frontdesk: ConciergeBell,
  followup: Repeat,
  books: Receipt,
  content: Megaphone,
  internal: Newspaper,
};

/** Render the flow diagram for `lanes`, or a way to start when nothing runs yet. */
export function WorkFlow({
  lanes,
  approvalsHref,
  workflowsHref,
  waiting,
}: {
  readonly lanes: readonly FlowLane[];
  readonly approvalsHref: string;
  readonly workflowsHref: string;
  /** Drafts waiting in Approvals right now. */
  readonly waiting: number;
}) {
  if (lanes.length === 0) {
    return (
      <EmptyState
        title="Nothing runs yet"
        actions={
          <ButtonLink href={workflowsHref} variant="secondary">
            Change paths
          </ButtonLink>
        }
      >
        Pick a tool or an agent for a workflow, and its route shows up here.
      </EmptyState>
    );
  }

  const rows = flowRows(lanes);

  return (
    <div className={styles.frame}>
      <div className={styles.flow}>
        {/* The headings repeat in each route's own words, so screen readers skip this row */}
        <p className={styles.colHead} data-col="trigger" aria-hidden="true">
          It starts when
        </p>
        <p className={styles.colHead} data-col="node" aria-hidden="true">
          Picked up by
        </p>
        <p className={styles.colHead} data-col="ok" aria-hidden="true">
          {rows.band === null ? "Who decides" : "Waits for your OK"}
        </p>
        <p className={styles.colHead} data-col="result" aria-hidden="true">
          You get
        </p>
        {rows.band !== null && (
          <span className={styles.band} style={{ gridRow: `1 / ${rows.band.foot + 1}` }} aria-hidden="true" />
        )}

        {rows.agents.length > 0 && (
          <ol className={styles.lanes} aria-label="Work your agents draft for your OK">
            {rows.agents.map(({ lane, start }) => (
              <Lane key={lane.handler.id} lane={lane} start={start} />
            ))}
          </ol>
        )}
        {rows.band !== null && (
          <p className={styles.foot} style={{ gridRow: rows.band.foot }}>
            Every draft lands in <Link href={approvalsHref}>Approvals</Link> and your morning brief.{" "}
            {waiting === 0 ? "Nothing waits right now." : `${waiting} ${waiting === 1 ? "waits" : "wait"} right now.`}
          </p>
        )}

        {rows.divider !== null && (
          <p className={styles.divider} style={{ gridRow: rows.divider }}>
            Tools work outside your Anchored approvals
          </p>
        )}
        {rows.tools.length > 0 && (
          <ol className={styles.lanes} aria-label="Work your tools handle">
            {rows.tools.map(({ lane, start }) => (
              <Lane key={lane.handler.id} lane={lane} start={start} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** Render one agent or tool: its box, spanning its routes' rows on the wide grid, then each route. */
function Lane({ lane, start }: { readonly lane: FlowLane; readonly start: number }) {
  const { handler } = lane;
  const Icon = handlerIcon(handler);
  return (
    <li className={styles.lane}>
      <div
        className={styles.node}
        data-kind={handler.kind === "agent" ? "agent" : handler.path}
        style={{ gridRow: `${start} / span ${lane.routes.length}` }}
      >
        <Icon className={styles.nodeIcon} aria-hidden="true" size={18} />
        <span className={styles.nodeText}>
          <b className={styles.nodeName}>{handler.kind === "agent" ? `${handler.name} agent` : handler.name}</b>
          <span className={styles.nodeNote}>{handler.note}</span>
        </span>
      </div>
      <ol className={styles.routes}>
        {lane.routes.map((route, i) => (
          <Route key={route.key} route={route} row={start + i} approves={handler.kind === "agent"} />
        ))}
      </ol>
    </li>
  );
}

/** Render one route as a row: what starts it, the handoff, and what the owner gets. */
function Route({ route, row, approves }: { readonly route: FlowRoute; readonly row: number; readonly approves: boolean }) {
  return (
    <li className={styles.route} style={{ gridRow: row }}>
      <p className={styles.trigger}>{route.trigger}</p>
      <span className={`${styles.wire} ${styles.wireIn}`} aria-hidden="true" />
      <span className={`${styles.wire} ${styles.wireMid}`} aria-hidden="true" />
      <p className={styles.ok} data-kind={approves ? "agent" : "tool"}>
        <span className={styles.okTag}>{approves ? "Waits for your OK" : "Not through Anchored"}</span>
        {route.handoff}
      </p>
      <span className={`${styles.wire} ${styles.wireOut}`} aria-hidden="true" />
      <p className={styles.result}>
        <CircleCheck className={styles.resultIcon} aria-hidden="true" size={17} />
        <span>
          <span className={styles.srOnly}>You get: </span>
          {route.result}
          {route.stake !== null && <span className={styles.stake}>{route.stake}</span>}
        </span>
      </p>
    </li>
  );
}

function handlerIcon(handler: FlowHandler): LucideIcon {
  if (handler.kind === "tool") return handler.path === "turnon" ? ToggleRight : Plug;
  return isNiche(handler.id) ? Sparkles : AGENT_ICON[handler.id];
}

/** Whether an agent was spawned for this business, so it has no core icon. */
function isNiche(ref: AgentRef): ref is `niche:${string}` {
  return ref.startsWith("niche:");
}

