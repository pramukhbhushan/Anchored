import { Check } from "lucide-react";
import Link from "next/link";
import { ChooseButton } from "@/components/business/ChooseButton";
import { toolsHref } from "@/components/routes";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Stamp } from "@/components/ui/Stamp";
import { money, ownerWords } from "@/components/view-helpers";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { SKILLS } from "@/lib/domain/agents";
import { toolById, toolName } from "@/lib/domain/catalog";
import { monthlyCost, pathOptions } from "@/lib/domain/paths";
import { rateTool } from "@/lib/domain/rating";
import { PATH_LABEL, WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile, Choice, Tool, WorkflowId, WorkflowPlan } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// One workflow as a line on the Workflows page's work order: a native
// `<details>` whose summary names the workflow, what runs it and the stamp for
// the path the owner is on, with the money at stake (or the reason) under it.
// Opened, it lists only the paths that exist here, each with Choose or a
// "Chosen" check. Server-rendered; linkable and opened from `#wf-<id>`.

/** One path the owner can pick for this workflow. */
interface PathRow {
  readonly kind: "turnon" | "buy" | "build";
  readonly label: string;
  readonly sub: string;
  readonly request: SetChoiceRequest;
}

/** Return what a tool costs a month for this business, as the summary line says it. */
function priceText(tool: Tool, business: BusinessProfile): string {
  const cost = monthlyCost(tool, business);
  if (cost === null) return "on quote";
  return cost === 0 ? "free" : `${money(cost)} a month`;
}

/** Return the tool the owner turned on, or the one Anchored would turn on, for this workflow. */
function ownedTool(choice: Choice, plan: WorkflowPlan, owned: readonly Tool[]): Tool | undefined {
  // The owned tool the owner turned on; else our preferred one if they own it; else the first they own.
  return (choice.path === "turnon" ? toolById(choice.toolId) : undefined) ?? owned.find((t) => t.id === plan.tool) ?? owned[0];
}

/** Return the catalog tool for the buy path: the one chosen, else our pick unless owned, else the top-rated one. */
function buyTool(choice: Choice, plan: WorkflowPlan, options: ReturnType<typeof pathOptions>): Tool | undefined {
  const id =
    choice.path === "buy"
      ? choice.toolId
      : plan.tool !== undefined && !options.owned.some((t) => t.id === plan.tool)
        ? plan.tool
        : options.buy[0]?.tool.id;
  return id === undefined ? undefined : toolById(id);
}

/** Render the work-order line for workflow `id`, with `choice` as the path the owner has now. */
export function OppCard({
  business,
  id,
  plan,
  choice,
}: {
  readonly business: BusinessProfile;
  readonly id: WorkflowId;
  readonly plan: WorkflowPlan;
  readonly choice: Choice;
}) {
  const name = WORKFLOWS[id].name;
  const options = pathOptions(business, id);
  const owned = ownedTool(choice, plan, options.owned);
  const buy = buyTool(choice, plan, options);
  const build = options.build;

  const paths: PathRow[] = [
    ...(owned
      ? [{ kind: "turnon" as const, label: toolName(owned), sub: `You already use ${owned.platform ?? "it"}`, request: { workflow: id, path: "turnon" as const, toolId: owned.id } }]
      : []),
    ...(buy
      ? [{ kind: "buy" as const, label: toolName(buy), sub: `${buy.price}. Fit ${rateTool(buy, business).total}`, request: { workflow: id, path: "buy" as const, toolId: buy.id } }]
      : []),
    ...(build
      ? [{ kind: "build" as const, label: `${build.agentName} agent`, sub: build.skills.map((s) => SKILLS[s].job).join(". "), request: { workflow: id, path: "build" as const } }]
      : []),
  ];

  // What runs the workflow now, said once in the summary beside its stamp.
  const runs =
    choice.path === "turnon" && owned
      ? toolName(owned)
      : choice.path === "buy" && buy
        ? `${toolName(buy)}, ${priceText(buy, business)}`
        : choice.path === "build" && build
          ? `${build.agentName} agent`
          : "";
  const stake = ownerWords(plan.stake);
  const why = ownerWords(plan.why);

  return (
    <details className={`wf${choice.path === "skip" ? " is-skipped" : ""}`} id={`wf-${id}`}>
      <summary className="wf-sum">
        <span className="wf-name">
          {name}
          {plan.isNew && <Badge tone="new">New</Badge>}
        </span>
        <span className="wf-runs">
          {runs !== "" && <span className="sr">, run by </span>}
          {runs}
        </span>
        <span className="wf-stamp">
          <span className="sr">, path: </span>
          <Stamp path={choice.path} />
        </span>
        <span className="wf-toggle" aria-hidden="true">
          <span className="wf-open">Change</span>
          <span className="wf-close">Close</span>
        </span>
        <span className="wf-line">{stake !== "" ? stake : why}</span>
      </summary>
      <div className="wf-body">
        {stake !== "" && <p className="wf-why">{why}</p>}
        {choice.path !== plan.rec && <p className="wf-pick">We&apos;d pick {PATH_LABEL[plan.rec]}.</p>}
        {paths.length > 0 && (
          <ul className="wf-paths" aria-label={`Paths for ${name}`}>
            {paths.map((path) => {
              const chosen = choice.path === path.kind;
              return (
                <li key={path.kind} className="wf-path">
                  <span className="k">{PATH_LABEL[path.kind]}</span>
                  <span className="v">
                    {path.label}
                    {path.sub !== "" && <small>{path.sub}</small>}
                  </span>
                  {chosen ? (
                    <span className="wf-chosen">
                      <Check aria-hidden="true" size={16} />
                      Chosen
                    </span>
                  ) : (
                    <ChooseButton
                      businessId={business.id}
                      request={path.request}
                      className={buttonClass("secondary", "sm")}
                      label={`Choose ${PATH_LABEL[path.kind]}: ${path.label} for ${name}`}
                      runner={path.label}
                    >
                      Choose
                    </ChooseButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="wf-foot">
          {choice.path === "skip" ? (
            <span className="wf-skipped">Skipped for now</span>
          ) : (
            <ChooseButton
              businessId={business.id}
              request={{ workflow: id, path: "skip" }}
              className={buttonClass("quiet", "sm")}
              label={`Skip ${name} for now`}
            >
              Skip for now
            </ChooseButton>
          )}
          <Link className={buttonClass("quiet", "sm")} href={toolsHref(business.id, id)} aria-label={`Compare tools for ${name}`}>
            Compare tools for this
          </Link>
        </div>
      </div>
    </details>
  );
}
