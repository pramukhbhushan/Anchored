import styles from "@/components/site/landing.module.css";
import { Stamp } from "@/components/ui/Stamp";
import { money } from "@/components/view-helpers";
import { DISCOVERY_QUEUE, toolName } from "@/lib/domain/catalog";
import { pathOptions, workflowIdsOf } from "@/lib/domain/paths";
import { CHECKS, STATUS_LABEL } from "@/lib/domain/rating";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile, CheckKey, CheckStatus, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's second step for one business: features inside software
// it already runs, the catalog tools for one workflow rated on the seven
// checks, and the discovery agent's unchecked listings for that workflow.
// Every number comes from `pathOptions` and `rateTool`, as the app shows them.

/** Column heads short enough for the matrix; the full label is read out to screen readers. */
const SHORT: Readonly<Record<CheckKey, string>> = {
  connects: "Connects",
  price: "Pricing",
  charge: "In charge",
  data: "Data use",
  start: "Easy start",
  langs: "Languages",
  proven: "Proven",
};

/** The shape class for each check status. */
const SHAPE: Readonly<Record<CheckStatus, string | undefined>> = {
  met: styles.met,
  partly: styles.partly,
  unknown: styles.unknown,
  no: styles.notMet,
};

const STATUSES: readonly CheckStatus[] = ["met", "partly", "unknown", "no"];

// Three rows fit beside the claim without scrolling.
const SHOWN = 3;

/** Render what `business` already owns, the rated tools for `workflow`, and the listings waiting for a check. */
export function ToolCompare({ business, workflow }: { readonly business: BusinessProfile; readonly workflow: WorkflowId }) {
  const owned = workflowIdsOf(business).flatMap((w) =>
    pathOptions(business, w).owned.map((tool) => ({ workflow: w, tool })),
  );
  const { buy } = pathOptions(business, workflow);
  const rated = buy.slice(0, SHOWN);
  const waiting = DISCOVERY_QUEUE.filter((listing) => listing.workflow === workflow).map((listing) => listing.name);

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetHead}>
        <p className={styles.sheetName}>{business.name}</p>
        <p className={styles.sheetSub}>
          {business.trade}, runs {business.tools.join(", ")}
        </p>
      </div>

      {owned.length > 0 && (
        <div className={styles.part}>
          {owned.map(({ workflow: w, tool }) => (
            <div className={styles.owned} key={`${w}-${tool.id}`}>
              <div>
                <p className={styles.partTitle}>
                  {WORKFLOWS[w].name}: {toolName(tool)}
                </p>
                <p className={styles.partText}>Already inside {tool.platform}, which you pay for. Nothing new to buy.</p>
              </div>
              <Stamp path="turnon" />
            </div>
          ))}
        </div>
      )}

      <div className={`${styles.part} ${styles.partOpen}`}>
        <div className={styles.owned}>
          <div>
            <p className={styles.partTitle}>{WORKFLOWS[workflow].name}: nothing you own covers it</p>
            <p className={styles.partText}>
              {buy.length} catalog tools do, each scored out of 100 for this business.
            </p>
          </div>
          <Stamp path="buy" />
        </div>
      </div>

      <div className={styles.matrixWrap}>
        <table className={styles.matrix}>
          <caption className="sr">
            Catalog tools for {WORKFLOWS[workflow].name}, rated on seven checks for {business.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">Tool</th>
              <th scope="col">Score</th>
              {CHECKS.map(({ key, label }) => (
                <th scope="col" key={key}>
                  <span aria-hidden="true">{SHORT[key]}</span>
                  <span className="sr">{label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rated.map(({ tool, rating }, index) => (
              <tr key={tool.id} className={index === 0 ? styles.best : undefined}>
                <th scope="row">
                  <span className={styles.toolName}>{toolName(tool)}</span>
                  <span className={styles.toolPrice}>
                    {tool.monthly === null ? "Price on request" : `${money(tool.monthly)} a month`}
                  </span>
                </th>
                <td>
                  <span className={styles.score}>{rating.total}</span>
                </td>
                {CHECKS.map(({ key }) => {
                  const [status] = rating.checks[key];
                  return (
                    <td key={key}>
                      <span className={`${styles.st} ${SHAPE[status] ?? ""}`} aria-hidden="true" />
                      <span className="sr">{STATUS_LABEL[status]}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.key} aria-hidden="true">
        {STATUSES.map((status) => (
          <span key={status}>
            <span className={`${styles.st} ${SHAPE[status] ?? ""}`} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </p>

      {waiting.length > 0 && (
        <p className={styles.queue}>
          <b>Found by the discovery agent, not scored yet:</b> {joinNames(waiting)}. A listing gets a score only after a
          person checks its facts.
        </p>
      )}
    </div>
  );
}

/** Join names as "A", "A and B" or "A, B and C". */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
