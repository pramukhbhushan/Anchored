import styles from "@/components/site/landing.module.css";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { BASE_WORKFLOWS, NOT_GIVEN, WORKFLOWS, WORKFLOW_IDS } from "@/lib/domain/workflows";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's first step: the example business's profile above the
// rule sheet, with a box ticked for each answer that added a workflow, so a
// visitor sees which answers turn into which workflows.

/** A workflow that an onboarding answer adds; the five base workflows come with every business. */
type AddedWorkflow = Exclude<WorkflowId, "calls" | "books" | "leads" | "social" | "quotes">;

/** The answer that adds each workflow, in the owner's words, as `matchWorkflows` in lib/domain/engine.ts reads it. */
const WHEN: Readonly<Record<AddedWorkflow, string>> = {
  invoices: "You buy from suppliers",
  disputes: "You sell on delivery apps",
  noshows: "Customers book appointments or tables",
  scheduling: "Staff work shifts",
  reviews: "New customers find you on Google",
  catering: "You take catering or events",
  snap: "You accept SNAP",
  licenses: "You hold licenses or permits",
  memberships: "You sell plans or memberships",
  referrals: "Referrals bring you booked or quoted work",
};

const ADDED: readonly AddedWorkflow[] = WORKFLOW_IDS.filter((id): id is AddedWorkflow => !WORKFLOWS[id].base);
const BASE_NAMES = BASE_WORKFLOWS.map((id) => WORKFLOWS[id].name).join(", ");

/** Render the example business's profile and the rule sheet it ticks. */
export function RulesSheet() {
  const business = SAMPLE_BUSINESS;
  const applies = (id: WorkflowId) => business.workflows[id] !== undefined;
  const addedCount = ADDED.filter(applies).length;
  const facts: readonly (readonly [string, readonly string[]])[] = [
    ["Customers reach you by", business.reach],
    ["Runs on", business.tools],
    ["Speaks", business.languages],
  ];

  return (
    <div>
      <div className={styles.sheet}>
        <div className={styles.sheetHead}>
          <p className={styles.sheetName}>{business.name}</p>
          <p className={styles.sheetSub}>
            {business.trade}
            {business.place === NOT_GIVEN ? "" : `, ${business.place}`}
          </p>
          <dl className={styles.facts}>
            {facts.map(([label, values]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{values.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </div>
        <table className={styles.rules}>
          <caption className="sr">Answers that add workflows for {business.name}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr">Applies</span>
              </th>
              <th scope="col">When you tell us</th>
              <th scope="col">Anchored adds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Box on />
              </td>
              <th scope="row">Every business</th>
              <td>{BASE_NAMES}</td>
            </tr>
            {ADDED.map((id) => {
              const on = applies(id);
              return (
                <tr key={id} className={on ? undefined : styles.off}>
                  <td>
                    <Box on={on} />
                  </td>
                  <th scope="row">{WHEN[id]}</th>
                  <td>{WORKFLOWS[id].name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={styles.count}>
          {business.name} gets the five shared workflows plus {addedCount} of {ADDED.length} more.
        </p>
      </div>
    </div>
  );
}

/** Render a form checkbox, inked when the answer applies, with its state for screen readers. */
function Box({ on = false }: { readonly on?: boolean }) {
  return (
    <>
      <span className={on ? `${styles.box} ${styles.on}` : styles.box} aria-hidden="true" />
      <span className="sr">{on ? "Applies" : "Doesn't apply"}</span>
    </>
  );
}
