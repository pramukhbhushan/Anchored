"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";
import { CheckGrid, StatusBadge } from "@/components/business/CheckGrid";
import { ChooseButton } from "@/components/business/ChooseButton";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { fitLine } from "@/components/view-helpers";
import { CHECKS } from "@/lib/domain/rating";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { Rating, Tool, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The tools page's rated list. The server rates every tool; this component
// hides tools built for other kinds of business until the owner asks, keeps
// which ones (up to three) the owner is comparing in a tray pinned under the
// list, and opens the side-by-side table in a dialog so nothing above shifts.

const MAX_COMPARED = 3;

/** One catalog tool as rated for this business, with what the card needs to say about it. */
export interface CompareItem {
  readonly tool: Tool;
  /** The display name from `toolName`, worked out on the server so the catalog stays out of the browser. */
  readonly name: string;
  readonly rating: Rating;
  /** Part of software the owner already pays for, so choosing it means "turn on". */
  readonly owned: boolean;
  /** The business's workflows the owner has already turned on or bought this tool for. */
  readonly chosenFor: readonly WorkflowId[];
  /** Built for this kind of business or already owned. Other tools wait behind a toggle. */
  readonly forThisBusiness: boolean;
  /** The business's workflows this tool covers, in the tool's own order. */
  readonly workflows: readonly WorkflowId[];
}

/** Return the vendor link text: the URL without scheme or `www.`, cut to 48 characters. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48);
}

/** Render the comparison table for two or three tools; each cell carries its tool's name for the phone layout. */
function SideBySide({ items }: { readonly items: readonly CompareItem[] }) {
  return (
    <div className="scroll">
      <table className="rtable cmp-table">
        <thead>
          <tr>
            <th scope="col">Check</th>
            {items.map((item) => (
              <th scope="col" key={item.tool.id}>
                {item.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Fit for you</th>
            {items.map((item) => (
              <td className="num" data-label={item.name} key={item.tool.id}>
                {/* One child per cell: at phone width the cell is a two-column grid of label and content */}
                <span>
                  <b>{item.rating.total}</b>/100
                </span>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">Price</th>
            {items.map((item) => (
              <td data-label={item.name} key={item.tool.id}>
                {item.tool.price}
              </td>
            ))}
          </tr>
          {CHECKS.map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {items.map((item) => {
                const [status, , note] = item.rating.checks[key];
                return (
                  <td data-label={item.name} key={item.tool.id}>
                    <div>
                      <StatusBadge status={status} />
                      <span className="cmp-note">{note}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render one tool's card: score, price, badges, the seven checks, where it's in the stack, and its actions. */
function ToolCard({
  businessId,
  item,
  filter,
  comparing,
  onCompare,
}: {
  readonly businessId: string;
  readonly item: CompareItem;
  readonly filter: WorkflowId | "all";
  readonly comparing: boolean;
  readonly onCompare: () => void;
}) {
  const { tool, rating, owned, chosenFor } = item;
  const verb = owned ? "Turn on" : "Choose";
  // Offer only workflows this tool doesn't already run, so a tap never moves a workflow it already covers.
  const open = (filter === "all" ? item.workflows : [filter]).filter((w) => !chosenFor.includes(w));
  const [target] = open;
  const shownStack = filter === "all" ? chosenFor : chosenFor.filter((w) => w === filter);
  return (
    <article className="tool">
      <p className="score">
        <b>{rating.total}</b>
        <small>/100 fit</small>
      </p>
      <div className="tool-main">
        <h3>{item.name}</h3>
        <p className="tool-meta">{tool.price}</p>
        <div className="badges">
          {item.workflows.map((w) => (
            <Badge key={w}>{WORKFLOWS[w].name}</Badge>
          ))}
          {owned && <Badge tone="good">You already use it</Badge>}
          {!item.forThisBusiness && <Badge tone="warn">Built for other businesses</Badge>}
          {tool.ai === true && <Badge tone="info">AI on the job</Badge>}
          {tool.ai === false && <Badge>No AI</Badge>}
          {tool.ai === null && <Badge>AI not stated</Badge>}
        </div>
        <p className="tool-fit">{fitLine(rating, CHECKS.length)}</p>
        <details className="tool-checks">
          <summary>See the {CHECKS.length} checks</summary>
          <CheckGrid rating={rating} />
          <p className="fine">
            Source:{" "}
            {tool.source.url ? (
              <a href={tool.source.url} target="_blank" rel="noopener">
                {shortUrl(tool.source.url)}
              </a>
            ) : (
              tool.source.label
            )}
            . Checked {tool.checkedOn}.
          </p>
        </details>
      </div>
      <div className="tool-acts">
        {shownStack.length > 0 && (
          <Badge tone="good" className="tool-in-stack">
            In your stack for {shownStack.map((w) => WORKFLOWS[w].name.toLowerCase()).join(" and ")}
          </Badge>
        )}
        {target !== undefined && (
          <ChooseButton
            businessId={businessId}
            request={{ workflow: target, path: owned ? "turnon" : "buy", toolId: tool.id }}
            className={buttonClass("primary", "sm")}
            label={`${verb} ${item.name} for ${WORKFLOWS[target].name.toLowerCase()}`}
          >
            {verb} for {WORKFLOWS[target].name.toLowerCase()}
          </ChooseButton>
        )}
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={comparing}
          aria-label={`Compare ${item.name}`}
          onClick={onCompare}
        >
          {comparing ? "Comparing" : "Compare"}
        </Button>
      </div>
    </article>
  );
}

/** Render the trade toggle, every tool that matches `filter`, the compare tray and the comparison dialog. */
export function CompareBoard({
  businessId,
  items,
  filter,
}: {
  readonly businessId: string;
  readonly items: readonly CompareItem[];
  readonly filter: WorkflowId | "all";
}) {
  // Ids in the order picked; the oldest drops out when a fourth is added.
  const [compared, setCompared] = useState<readonly string[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  function toggle(id: string) {
    setCompared((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-MAX_COMPARED),
    );
  }

  // The tray looks up every rated tool, so a compared tool stays in it when the filter hides its card.
  const byId = new Map(items.map((item) => [item.tool.id, item]));
  const comparedItems = compared.flatMap((id) => byId.get(id) ?? []);
  const inFilter = filter === "all" ? items : items.filter((item) => item.workflows.includes(filter));
  const otherCount = inFilter.filter((item) => !item.forThisBusiness).length;
  const visible = showOthers ? inFilter : inFilter.filter((item) => item.forThisBusiness);

  return (
    <div className="tools-board">
      {otherCount > 0 && (
        <label className="toggle">
          <input type="checkbox" checked={showOthers} onChange={(event) => setShowOthers(event.target.checked)} />
          Show tools built for other businesses ({otherCount})
        </label>
      )}
      <div className="tools">
        {visible.length === 0 ? (
          <p className="panel muted">
            No catalog tool built for your kind of business covers this workflow yet. That&apos;s a gap an Anchored
            agent can fill on the Workflows page.
          </p>
        ) : (
          visible.map((item) => (
            <ToolCard
              key={item.tool.id}
              businessId={businessId}
              item={item}
              filter={filter}
              comparing={compared.includes(item.tool.id)}
              onCompare={() => toggle(item.tool.id)}
            />
          ))
        )}
      </div>

      {comparedItems.length > 0 && (
        <div className="compare-tray" role="region" aria-label="Tools to compare">
          <p aria-live="polite">
            {comparedItems.length === 1
              ? `${comparedItems[0]?.name} picked. Pick one more to compare.`
              : `Comparing ${comparedItems.map((item) => item.name).join(", ")}.`}
          </p>
          <div className="row">
            <Button size="sm" disabled={comparedItems.length < 2} onClick={() => dialog.current?.showModal()}>
              Compare side by side
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCompared([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby="compare-title"
        // A click on the backdrop lands on the dialog element itself; clicks inside land on its children.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-head">
          <h2 id="compare-title">Side by side</h2>
          <button type="button" className="icon-btn" aria-label="Close comparison" onClick={() => dialog.current?.close()}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {comparedItems.length >= 2 && <SideBySide items={comparedItems} />}
      </dialog>
    </div>
  );
}
