import Link from "next/link";
import { skillList } from "@/components/agent-labels";
import { ChooseButton } from "@/components/ChooseButton";
import { toolsHref } from "@/components/routes";
import { FitBar, Stamp } from "@/components/Stamp";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { toolById, toolName } from "@/lib/domain/catalog";
import { pathOptions } from "@/lib/domain/paths";
import { rateTool } from "@/lib/domain/rating";
import { PATH_LABEL, WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile, Choice, WorkflowId, WorkflowPlan } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// One workflow card on the workflows page: fit, the path the owner is on as a
// stamp (with "Our pick" when it differs), the reason and the stake, then the
// three path rows with the chosen one marked. Server-rendered; only the Choose
// and Skip buttons run in the browser. Each card is linkable at `#wf-<id>`.

/** One path row's content. An empty `label` means the path isn't available here. */
interface PathRowProps {
  readonly businessId: string;
  readonly workflowName: string;
  readonly kind: "turnon" | "buy" | "build";
  readonly label: string;
  readonly sub: string;
  readonly request: SetChoiceRequest | null;
  readonly chosen: boolean;
}

/** Render one path: its name, what would run it, and a Choose toggle when it's available. */
function PathRow({ businessId, workflowName, kind, label, sub, request, chosen }: PathRowProps) {
  const available = label !== "" && request !== null;
  return (
    <div className={`path${chosen ? " chosen" : ""}${available ? "" : " none"}`}>
      <span className="k">{PATH_LABEL[kind]}</span>
      <span className="v">
        {available ? label : sub}
        {available && sub !== "" && <small>{sub}</small>}
      </span>
      {available && (
        <ChooseButton
          businessId={businessId}
          request={request}
          className={buttonClass(chosen ? "primary" : "secondary", "sm")}
          pressed={chosen}
          label={`Choose ${PATH_LABEL[kind]}: ${label} for ${workflowName}`}
        >
          {chosen ? "Chosen" : "Choose"}
        </ChooseButton>
      )}
    </div>
  );
}

/** Render the card for workflow `id`, with `choice` as the path the owner has now. */
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
  // Show the owned tool the owner turned on; else our preferred one if they own it; else the first they own.
  const owned =
    (choice.path === "turnon" ? toolById(choice.toolId) : undefined) ??
    options.owned.find((t) => t.id === plan.tool) ??
    options.owned[0];
  // Show the tool already chosen; else our preferred tool unless the owner already has it; else the top-rated one.
  const buyId =
    choice.path === "buy"
      ? choice.toolId
      : plan.tool !== undefined && !options.owned.some((t) => t.id === plan.tool)
        ? plan.tool
        : options.buy[0]?.tool.id;
  const buyTool = buyId === undefined ? undefined : toolById(buyId);
  const build = options.build;
  const followsPick = choice.path === plan.rec;

  return (
    <article className={`opp${choice.path === "skip" ? " dim" : ""}`} id={`wf-${id}`}>
      <header className="opp-head">
        <div>
          <h3>{name}</h3>
          <FitBar fit={plan.fit} />
        </div>
        <div className="opp-verdict">
          <span className="sr">Your path:</span>
          <Stamp path={choice.path} />
          <span className="opp-pick">{followsPick ? "Our pick" : `Our pick: ${PATH_LABEL[plan.rec]}`}</span>
        </div>
      </header>
      {plan.isNew && (
        <Badge tone="new" className="opp-new">
          New for you
        </Badge>
      )}
      <p className="why">{plan.why}</p>
      {plan.stake !== "" && <p className="stake">{plan.stake}</p>}
      <div className="paths">
        <PathRow
          businessId={business.id}
          workflowName={name}
          kind="turnon"
          label={owned ? toolName(owned) : ""}
          sub={owned ? `You already use ${owned.platform ?? "it"}` : "Nothing you use covers this"}
          request={owned ? { workflow: id, path: "turnon", toolId: owned.id } : null}
          chosen={choice.path === "turnon"}
        />
        <PathRow
          businessId={business.id}
          workflowName={name}
          kind="buy"
          label={buyTool ? toolName(buyTool) : ""}
          sub={buyTool ? `${buyTool.price}. Scores ${rateTool(buyTool, business).total}/100 on our checks` : "No catalog tool yet"}
          request={buyTool ? { workflow: id, path: "buy", toolId: buyTool.id } : null}
          chosen={choice.path === "buy"}
        />
        <PathRow
          businessId={business.id}
          workflowName={name}
          kind="build"
          label={build ? `${build.agentName} agent` : ""}
          sub={build ? skillList(build.skills) : "Anchored doesn't build this one"}
          request={build ? { workflow: id, path: "build" } : null}
          chosen={choice.path === "build"}
        />
      </div>
      <div className="opp-foot">
        {choice.path === "skip" ? (
          <span className="muted">Skipped for now</span>
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
    </article>
  );
}
