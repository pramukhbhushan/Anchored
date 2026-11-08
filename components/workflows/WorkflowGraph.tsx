import { CircleCheck, CircleDashed } from "lucide-react";
import { Fragment } from "react";
import { WorkflowTile } from "@/components/business/WorkflowTile";
import { Badge } from "@/components/ui/Badge";
import { ChangeHandler } from "@/components/workflows/ChangeHandler";
import type { ChangeOption, FlowRoute, WhoHandles, WorkflowFlow } from "@/components/workflows/flow";
import styles from "@/components/workflows/graph.module.css";
import type { Stage } from "@/lib/domain/stages";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The Workflows graph: the business's day as stage lanes on one rail, each
// workflow a node whose work flows right from what starts it, to who handles
// it, to the owner's OK, to what the owner gets. It is headings, lists and
// text, so it is its own text equivalent; CSS draws the boxes and connectors.

/** One stage of the graph and the workflows in it. */
export interface GraphStage {
  readonly stage: Stage;
  readonly jobs: readonly GraphJob[];
}

/** One workflow on the graph, with the ways to change who handles it. */
export interface GraphJob {
  readonly flow: WorkflowFlow;
  readonly options: readonly ChangeOption[];
  /** The owner changed this step since approving the plan. */
  readonly changed: boolean;
  readonly isNew: boolean;
}

/** Render the stage lanes for `stages`, with `toolsHref` naming where each workflow's tool comparison lives. */
export function WorkflowGraph({
  businessId,
  businessName,
  stages,
  toolsHref,
}: {
  readonly businessId: string;
  readonly businessName: string;
  readonly stages: readonly GraphStage[];
  readonly toolsHref: (id: WorkflowId) => string;
}) {
  return (
    <section className={styles.graph} aria-labelledby="graph-title">
      <h2 id="graph-title" className="sr">
        How {businessName} runs day to day
      </h2>
      {/* Each step names its column for screen readers, so they skip this row */}
      <div className={styles.heads} aria-hidden="true">
        <span className={styles.headJob}>Job</span>
        <div className={styles.headFlow}>
          <span>It starts when</span>
          <span>Who handles it</span>
          <span data-col="ok">Your OK</span>
          <span>You get</span>
        </div>
      </div>
      <ol className={styles.stages}>
        {stages.map(({ stage, jobs }) => (
          <li key={stage.id} className={styles.stage} aria-labelledby={`stage-${stage.id}`}>
            <header className={styles.stageHead}>
              <h2 id={`stage-${stage.id}`}>{stage.name}</h2>
              <p>{stage.blurb}</p>
            </header>
            <ol className={styles.jobs}>
              {jobs.map((job) => (
                <Job key={job.flow.id} businessId={businessId} job={job} compareHref={toolsHref(job.flow.id)} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Render one workflow: its node, then each route's steps, then the way to change who handles it. */
function Job({ businessId, job, compareHref }: { readonly businessId: string; readonly job: GraphJob; readonly compareHref: string }) {
  const { flow } = job;
  const { handler, routes } = flow;
  return (
    <li className={styles.job} id={`wf-${flow.id}`} data-kind={handler.kind} aria-labelledby={`wf-${flow.id}-name`}>
      <div className={styles.node}>
        <WorkflowTile id={flow.id} />
        <div className={styles.nodeText}>
          <h3 id={`wf-${flow.id}-name`} className={styles.nodeName}>
            {flow.name}
          </h3>
          {job.changed ? <Badge tone="info">Changed</Badge> : job.isNew && <Badge tone="new">New</Badge>}
        </div>
      </div>
      <div className={styles.flow}>
        {routes.map((route, i) => (
          <Fragment key={route.key}>
            <p className={styles.trigger} style={{ gridRow: i + 1 }} data-later={i > 0 ? "" : undefined}>
              <span className="sr">It starts when: </span>
              {route.trigger}
            </p>
            {i === 0 && <Handler handler={handler} rows={routes.length} />}
            <Ok route={route} kind={handler.kind} row={i + 1} />
            <Result route={route} row={i + 1} stake={i === 0 ? flow.stake : null} />
          </Fragment>
        ))}
      </div>
      <ChangeHandler businessId={businessId} name={flow.name} options={job.options} compareHref={compareHref} />
    </li>
  );
}

/** Render who handles the workflow, spanning its routes' rows on the wide graph. */
function Handler({ handler, rows }: { readonly handler: WhoHandles; readonly rows: number }) {
  return (
    <p className={styles.handler} data-kind={handler.kind} style={{ gridRow: `1 / span ${rows}` }}>
      <span className="sr">Who handles it: </span>
      <b className={styles.handlerName}>{handler.name}</b>
      <span className={styles.handlerNote}>{handler.note}</span>
    </p>
  );
}

/** Render the owner's OK on an agent's draft, the rule a tool runs by, or nothing for work nobody handles. */
function Ok({ route, kind, row }: { readonly route: FlowRoute; readonly kind: WhoHandles["kind"]; readonly row: number }) {
  if (route.draft !== null) {
    return (
      <p className={styles.ok} data-kind="agent" style={{ gridRow: row }}>
        <span className={styles.okTag}>You approve</span>
        {route.draft}
      </p>
    );
  }
  if (route.rule !== null) {
    return (
      <p className={styles.ok} data-kind="tool" style={{ gridRow: row }}>
        <span className={styles.okTag}>Runs on its own</span>
        {route.rule}
      </p>
    );
  }
  // Work nobody handles has no OK to give; the empty cell keeps the connector running to the result.
  return <span className={styles.ok} data-kind={kind} data-empty="" style={{ gridRow: row }} aria-hidden="true" />;
}

/** Render what the owner gets, with the money at stake; work nobody handles shows what rides on it. */
function Result({ route, row, stake }: { readonly route: FlowRoute; readonly row: number; readonly stake: string | null }) {
  const Icon = route.result === null ? CircleDashed : CircleCheck;
  return (
    <p className={styles.result} data-none={route.result === null ? "" : undefined} style={{ gridRow: row }}>
      <Icon className={styles.resultIcon} aria-hidden="true" size={18} />
      <span>
        <span className="sr">You get: </span>
        {route.result ?? "Nothing yet. You do this yourself."}
        {stake !== null && (
          <span className={styles.stake}>
            {route.result === null ? "At stake: " : ""}
            {stake}
          </span>
        )}
      </span>
    </p>
  );
}
