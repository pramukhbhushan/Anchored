import Link from "next/link";
import { skillList } from "@/components/agent-labels";
import { ChooseButton } from "@/components/ChooseButton";
import { compareHref } from "@/components/routes";
import { FitBar, Stamp } from "@/components/Stamp";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { toolById, toolName } from "@/lib/domain/catalog";
import { pathOptions } from "@/lib/domain/paths";
import { rateTool } from "@/lib/domain/rating";
import { PATH_LABEL, WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile, Choice, WorkflowId, WorkflowPlan } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// One workflow card on the workflows page: fit, our pick, the reason and the
// stake, then the three path rows (turn on, buy, build) with the chosen one
// marked. The build row names the agent and the skills it would run.
// Server-rendered; only the Choose and Skip buttons run in the browser.

/** One path row's content. An empty `label` means the path isn't available here. */
interface PathRowProps {
  readonly businessId: string;
  readonly kind: "turnon" | "buy" | "build";
  readonly label: string;
  readonly sub: string;
  readonly request: SetChoiceRequest | null;
  readonly chosen: boolean;
}

/** Render one path: its name, what would run it, and a Choose toggle when it's available. */
function PathRow({ businessId, kind, label, sub, request, chosen }: PathRowProps) {
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
          className={`btn sm${chosen ? "" : " ghost"}`}
          pressed={chosen}
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
  const options = pathOptions(business, id);
  const owned = options.owned[0];
  // Show the tool already chosen; else our preferred tool unless the owner already has it; else the top-rated one.
  const buyId =
    choice.path === "buy"
      ? choice.toolId
      : plan.tool !== undefined && !options.owned.some((t) => t.id === plan.tool)
        ? plan.tool
        : options.buy[0]?.tool.id;
  const buyTool = buyId === undefined ? undefined : toolById(buyId);
  const build = options.build;

  return (
    <article className={`opp${plan.rec === "skip" && choice.path === "skip" ? " dim" : ""}`}>
      <header>
        <div>
          <h3>{WORKFLOWS[id].name}</h3>
          <FitBar fit={plan.fit} />
        </div>
        <span title="Our pick">
          <Stamp path={plan.rec} />
        </span>
      </header>
      {plan.isNew && (
        <span className="chip new" style={{ alignSelf: "flex-start" }}>
          New for you
        </span>
      )}
      <p className="why">{plan.why}</p>
      {plan.stake !== "" && <p className="stake">{plan.stake}</p>}
      <div className="paths">
        <PathRow
          businessId={business.id}
          kind="turnon"
          label={owned ? toolName(owned) : ""}
          sub={owned ? `You already use ${owned.platform ?? "it"}` : "Nothing you use covers this"}
          request={owned ? { workflow: id, path: "turnon", toolId: owned.id } : null}
          chosen={choice.path === "turnon"}
        />
        <PathRow
          businessId={business.id}
          kind="buy"
          label={buyTool ? toolName(buyTool) : ""}
          sub={buyTool ? `${buyTool.price}. Fit ${rateTool(buyTool, business).total} for you` : "No catalog tool yet"}
          request={buyTool ? { workflow: id, path: "buy", toolId: buyTool.id } : null}
          chosen={choice.path === "buy"}
        />
        <PathRow
          businessId={business.id}
          kind="build"
          label={build ? `${build.agentName} agent` : ""}
          sub={build ? skillList(build.skills) : "Anchored doesn't build this one"}
          request={build ? { workflow: id, path: "build" } : null}
          chosen={choice.path === "build"}
        />
      </div>
      <div className="foot">
        {choice.path === "skip" ? (
          <span className="muted">Skipped</span>
        ) : (
          <ChooseButton businessId={business.id} request={{ workflow: id, path: "skip" }} className="linkbtn">
            Skip for now
          </ChooseButton>
        )}
        <Link className="linkbtn" href={compareHref(business.id, id)}>
          Compare tools for this
        </Link>
      </div>
    </article>
  );
}
