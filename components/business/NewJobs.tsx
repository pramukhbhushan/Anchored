import Link from "next/link";
import { AddJobButton, AddJobsGroup } from "@/components/business/AddJobButton";
import styles from "@/components/business/new-jobs.module.css";
import { priceChip } from "@/components/business/tool-visuals";
import toolStyles from "@/components/business/tools.module.css";
import { WorkflowTile } from "@/components/business/WorkflowTile";
import { businessHref, NEW_BUSINESS_HREF } from "@/components/routes";
import type { AddJobRequest } from "@/lib/api/contract";
import { toolName } from "@/lib/domain/catalog";
import type { NewJob } from "@/lib/domain/new-jobs";
import type { Tool } from "@/lib/domain/types";
import { WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The tools page's "More jobs you could hand off" band: jobs onboarding didn't
// pick for the business that a catalog tool or an Anchored agent can take on.
// Each card names the job, lists up to three tools rated for this business,
// and offers one button to add the job with the best way in, plus Anchored as
// a second way when a tool leads. The whole band shares one add at a time.
// The example business shows the jobs with a link to set up a business of
// one's own instead of buttons.

const LISTED_TOOLS = 3;

/** One way to add a job: the request, the visible and accessible button text, and the toast after it. */
interface AddOption {
  readonly request: AddJobRequest;
  readonly text: string;
  readonly done: string;
}

/** Return the ways to add `job`, best first: a tool the owner pays for, the best-rated tool, then Anchored. */
function addOptions(job: NewJob, name: string): AddOption[] {
  const options: AddOption[] = [];
  const [owned] = job.owned;
  const [best] = job.buy;
  if (owned !== undefined) {
    options.push({
      request: { workflow: job.workflow, path: "turnon", toolId: owned.id },
      text: `Add with your ${toolName(owned)}`,
      done: `${name} is in your workflows. Make sure the feature is on in your ${toolName(owned)}.`,
    });
  } else if (best !== undefined) {
    options.push({
      request: { workflow: job.workflow, path: "buy", toolId: best.tool.id },
      text: `Add with ${toolName(best.tool)}`,
      done: `${name} is in your workflows with ${toolName(best.tool)}. It starts once you sign up.`,
    });
  }
  if (job.build !== null) {
    options.push({
      request: { workflow: job.workflow, path: "build" },
      text: options.length === 0 ? "Add with Anchored" : "Or add with Anchored",
      done: `${name} is in your workflows. Anchored drafts it, you approve it.`,
    });
  }
  return options;
}

/** Render one tool line: its name, its price or that the owner already pays for it, and its fit when rated. */
function ToolLine({ tool, owned, total }: { readonly tool: Tool; readonly owned: boolean; readonly total: number | null }) {
  return (
    <li className={styles.tool}>
      <span className={styles.toolName}>{toolName(tool)}</span>
      <span className={toolStyles.chip}>{owned ? "You have it" : priceChip(tool)}</span>
      {total !== null && <span className={styles.fit}>Fit {total}/100</span>}
    </li>
  );
}

/** Render the band of jobs `jobs` for `businessId`; `canAdd` is false for the example, which keeps its jobs. */
export function NewJobs({
  businessId,
  jobs,
  canAdd,
}: {
  readonly businessId: string;
  readonly jobs: readonly NewJob[];
  readonly canAdd: boolean;
}) {
  if (jobs.length === 0) return null;
  const workflowsHref = businessHref(businessId, "workflows");

  return (
    <section className="section" aria-labelledby="new-jobs-title">
      <div className="section-head">
        <div>
          <h2 id="new-jobs-title">More jobs you could hand off</h2>
          {canAdd ? (
            <p>Onboarding picked your jobs from your answers. A tool or Anchored can take these on too. Add one and it joins your workflows.</p>
          ) : (
            <p>
              Onboarding picked this example&apos;s jobs from its owner&apos;s answers. A tool or Anchored can take these on too.{" "}
              <Link href={NEW_BUSINESS_HREF}>Set up your own business</Link> to add one.
            </p>
          )}
        </div>
      </div>
      <AddJobsGroup businessId={businessId}>
        <ul className={styles.grid}>
          {jobs.map((job) => {
            const name = WORKFLOWS[job.workflow].name;
            const tools = [
              ...job.owned.map((tool) => ({ tool, owned: true, total: null })),
              ...job.buy.map(({ tool, rating }) => ({ tool, owned: false, total: rating.total })),
            ].slice(0, LISTED_TOOLS);
            const options = canAdd ? addOptions(job, name) : [];
            return (
              <li key={job.workflow} className={styles.item}>
                <article className="card" aria-labelledby={`new-job-${job.workflow}`}>
                  <div className={styles.top}>
                    <WorkflowTile id={job.workflow} />
                    <h3 id={`new-job-${job.workflow}`}>{name}</h3>
                  </div>
                  {tools.length > 0 ? (
                    <ul className={styles.tools} aria-label={`Tools for ${name.toLowerCase()}`}>
                      {tools.map((line) => (
                        <ToolLine key={line.tool.id} {...line} />
                      ))}
                    </ul>
                  ) : (
                    <p className="card-why">No tool in our catalog does this yet. Anchored drafts the work and you approve each piece.</p>
                  )}
                  {options.length > 0 && (
                    <div className={styles.acts}>
                      {options.map((option, index) => (
                        <AddJobButton
                          key={option.request.path}
                          request={option.request}
                          variant={index === 0 ? "secondary" : "quiet"}
                          label={`${option.text} for ${name.toLowerCase()}`}
                          done={option.done}
                          workflowsHref={`${workflowsHref}#wf-${job.workflow}`}
                        >
                          {option.text}
                        </AddJobButton>
                      ))}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      </AddJobsGroup>
    </section>
  );
}
