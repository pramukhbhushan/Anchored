import { Bot, Check, CircleCheck, CirclePause, Inbox, PenLine, Power, ShoppingCart, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ChooseButton } from "@/components/business/ChooseButton";
import { priceChip } from "@/components/business/tool-visuals";
import styles from "@/components/business/workflows.module.css";
import { WorkflowTile } from "@/components/business/WorkflowTile";
import { toolsHref } from "@/components/routes";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Stamp } from "@/components/ui/Stamp";
import { money } from "@/components/view-helpers";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { SKILLS } from "@/lib/domain/agents";
import { toolById, toolName } from "@/lib/domain/catalog";
import { monthlyCost, pathOptions } from "@/lib/domain/paths";
import { rateTool } from "@/lib/domain/rating";
import { PATH_LABEL, WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile, Choice, PathOptions, Tool, WorkflowId, WorkflowPlan } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// One workflow as a line on the Workflows page's work order: a native
// `<details>` whose summary shows the workflow's icon and name, what runs it
// and the stamp for the path the owner is on, with the money at stake (or the
// reason) under it. Opened, it shows the three paths as tiles, the chosen one
// marked, and one line on what happens on that path. Server-rendered;
// linkable and opened from `#wf-<id>`.

/** A path the owner can take, or one that doesn't exist here and why. */
type PathTile =
  | {
      readonly kind: "turnon" | "buy" | "build";
      readonly available: true;
      readonly runner: string;
      readonly detail: string;
      /** Full text for the tile's tooltip, when the detail shortens it. */
      readonly title?: string;
      readonly request: SetChoiceRequest;
    }
  | { readonly kind: "turnon" | "buy" | "build"; readonly available: false; readonly reason: string };

const PATH_ICON: Readonly<Record<"turnon" | "buy" | "build", LucideIcon>> = {
  turnon: Power,
  buy: ShoppingCart,
  build: Bot,
};

const MISSING_REASON: Readonly<Record<"turnon" | "buy" | "build", string>> = {
  turnon: "Nothing you already use does this",
  buy: "No catalog tool for your kind of business yet",
  build: "No Anchored agent does this yet",
};

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
function buyTool(choice: Choice, plan: WorkflowPlan, options: PathOptions): Tool | undefined {
  const id =
    choice.path === "buy"
      ? choice.toolId
      : plan.tool !== undefined && !options.owned.some((t) => t.id === plan.tool)
        ? plan.tool
        : options.buy[0]?.tool.id;
  return id === undefined ? undefined : toolById(id);
}

/** Return the three path tiles for workflow `id`, in the order turn on, buy, build. */
function pathTiles(
  business: BusinessProfile,
  id: WorkflowId,
  owned: Tool | undefined,
  buy: Tool | undefined,
  build: PathOptions["build"],
): PathTile[] {
  const missing = (kind: PathTile["kind"]): PathTile => ({ kind, available: false, reason: MISSING_REASON[kind] });
  return [
    owned
      ? {
          kind: "turnon",
          available: true,
          runner: toolName(owned),
          detail: `Part of ${owned.platform ?? "software"} you already pay for`,
          request: { workflow: id, path: "turnon", toolId: owned.id },
        }
      : missing("turnon"),
    buy
      ? {
          kind: "buy",
          available: true,
          runner: toolName(buy),
          detail: `${priceChip(buy)}, fit ${rateTool(buy, business).total}`,
          title: buy.price,
          request: { workflow: id, path: "buy", toolId: buy.id },
        }
      : missing("buy"),
    build
      ? {
          kind: "build",
          available: true,
          runner: `${build.agentName} agent`,
          detail: build.skills.map((s) => SKILLS[s].job).join(". "),
          request: { workflow: id, path: "build" },
        }
      : missing("build"),
  ];
}

/** Lower-case the first letter, so a skill's "Drafts a reply" reads inside a sentence. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Render one line on what happens on the chosen path; the build path draws its three steps. */
function WhatHappens({
  choice,
  owned,
  buy,
  build,
}: {
  readonly choice: Choice;
  readonly owned: Tool | undefined;
  readonly buy: Tool | undefined;
  readonly build: PathOptions["build"];
}) {
  if (choice.path === "build") {
    const skill = build?.skills[0];
    if (build === null || skill === undefined) return null;
    const { reads, does } = SKILLS[skill];
    const steps: readonly { readonly Icon: LucideIcon; readonly text: string }[] = [
      { Icon: Inbox, text: reads[0] ?? "Your messages" },
      { Icon: PenLine, text: `${build.agentName} agent ${lowerFirst(does[0] ?? "Drafts the work")}` },
      { Icon: CircleCheck, text: "You approve each card before anything goes out" },
    ];
    return (
      <ol className={styles.flow} aria-label="What happens">
        {steps.map(({ Icon, text }) => (
          <li key={text}>
            <Icon aria-hidden="true" size={16} />
            <span>{text}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (choice.path === "turnon" && owned) {
    return (
      <p className={styles.happens}>
        <Power aria-hidden="true" size={16} />
        It runs inside {owned.platform ?? "software you have"}, which you already pay for. No new bill.
      </p>
    );
  }
  if (choice.path === "buy" && buy) {
    return (
      <p className={styles.happens}>
        <ShoppingCart aria-hidden="true" size={16} />
        You sign up for {toolName(buy)} and it does this work. {buy.price}.
      </p>
    );
  }
  if (choice.path === "skip") {
    return (
      <p className={styles.happens}>
        <CirclePause aria-hidden="true" size={16} />
        Nothing runs for now. You keep doing this yourself and can pick a path any time.
      </p>
    );
  }
  return null;
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
  const tiles = pathTiles(business, id, owned, buy, build);

  // What runs the workflow now, said once in the summary beside its stamp.
  const runs =
    choice.path === "turnon" && owned
      ? toolName(owned)
      : choice.path === "buy" && buy
        ? `${toolName(buy)}, ${priceText(buy, business)}`
        : choice.path === "build" && build
          ? `${build.agentName} agent`
          : "";
  const { stake, why } = plan;

  return (
    <details className={styles.wf} id={`wf-${id}`} data-skipped={choice.path === "skip" ? "" : undefined}>
      <summary className={styles.sum}>
        <span className={styles.icon}>
          <WorkflowTile id={id} />
        </span>
        <span className={styles.name}>
          {name}
          {plan.isNew && <Badge tone="new">New</Badge>}
        </span>
        <span className={styles.runs}>
          {runs !== "" && <span className="sr">, run by </span>}
          {runs}
        </span>
        <span className={styles.stamp}>
          <span className="sr">, path: </span>
          <Stamp path={choice.path} />
        </span>
        <span className={styles.toggle} aria-hidden="true">
          <span className={styles.open}>Change</span>
          <span className={styles.close}>Close</span>
        </span>
        <span className={styles.line}>{stake !== "" ? stake : why}</span>
      </summary>
      <div className={styles.body}>
        {stake !== "" && <p className={styles.why}>{why}</p>}
        <ul className={styles.paths} aria-label={`Paths for ${name}`}>
          {tiles.map((tile) => (
            <Tile key={tile.kind} businessId={business.id} tile={tile} name={name} chosen={choice.path === tile.kind} ours={plan.rec === tile.kind} />
          ))}
        </ul>
        <WhatHappens choice={choice} owned={owned} buy={buy} build={build} />
        <div className={styles.foot}>
          {choice.path === "skip" ? (
            <span className={styles.skipped}>Skipped for now</span>
          ) : (
            <>
              <ChooseButton
                businessId={business.id}
                request={{ workflow: id, path: "skip" }}
                className={buttonClass("quiet", "sm")}
                label={`Skip ${name} for now`}
              >
                Skip for now
              </ChooseButton>
              {plan.rec === "skip" && <span className={styles.ours}>Our pick</span>}
            </>
          )}
          <Link className={buttonClass("quiet", "sm")} href={toolsHref(business.id, id)} aria-label={`Compare tools for ${name}`}>
            Compare tools for this
          </Link>
        </div>
      </div>
    </details>
  );
}

/** Render one path tile: its icon and name, who runs it, and Choose or the chosen mark; a missing path says why. */
function Tile({
  businessId,
  tile,
  name,
  chosen,
  ours,
}: {
  readonly businessId: string;
  readonly tile: PathTile;
  readonly name: string;
  readonly chosen: boolean;
  readonly ours: boolean;
}) {
  const Icon = PATH_ICON[tile.kind];
  const label = PATH_LABEL[tile.kind];
  if (!tile.available) {
    return (
      <li className={styles.tile} data-path={tile.kind} data-missing="">
        <span className={styles.tileHead}>
          <Icon aria-hidden="true" size={18} />
          {label}
        </span>
        <span className={styles.tileDetail}>{tile.reason}</span>
      </li>
    );
  }
  return (
    <li className={styles.tile} data-path={tile.kind} data-chosen={chosen ? "" : undefined} title={tile.title}>
      <span className={styles.tileHead}>
        <Icon aria-hidden="true" size={18} />
        {label}
        {ours && !chosen && <span className={styles.ours}>Our pick</span>}
      </span>
      <span className={styles.tileRunner}>{tile.runner}</span>
      <span className={styles.tileDetail}>{tile.detail}</span>
      <span className={styles.tileAct}>
        {chosen ? (
          <span className={styles.chosen}>
            <Check aria-hidden="true" size={16} />
            Chosen
          </span>
        ) : (
          <ChooseButton
            businessId={businessId}
            request={tile.request}
            className={buttonClass("secondary", "sm")}
            label={`Choose ${label}: ${tile.runner} for ${name}`}
            runner={tile.runner}
          >
            Choose
          </ChooseButton>
        )}
      </span>
    </li>
  );
}
