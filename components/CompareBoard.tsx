"use client";

import { useEffect, useRef, useState } from "react";
import { CheckGrid } from "@/components/CheckGrid";
import { ChooseButton } from "@/components/ChooseButton";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { CHECKS, STATUS_LABEL } from "@/lib/domain/rating";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { Rating, Tool, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The compare page's tool list and side-by-side table. The server rates every
// tool; this component keeps which ones (up to three) the owner is comparing,
// shows them side by side once two are picked, and renders each tool's card.

const MAX_COMPARED = 3;

/** One catalog tool as rated for this business, with what the card needs to say about it. */
export interface CompareItem {
  readonly tool: Tool;
  /** The display name from `toolName`, worked out on the server so the catalog stays out of the browser. */
  readonly name: string;
  readonly rating: Rating;
  /** Part of software the owner already pays for, so choosing it means "turn on". */
  readonly owned: boolean;
  readonly inStack: boolean;
  /** The business's workflows this tool covers, in the tool's own order. */
  readonly workflows: readonly WorkflowId[];
}

/** Return the vendor link text the prototype showed: the URL without scheme or `www.`, cut to 48 characters. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48);
}

/** Render the compare table for two or three tools. */
function SideBySide({ items }: { readonly items: readonly CompareItem[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Side by side</th>
          {items.map((item) => (
            <th scope="col" key={item.tool.id}>
              {item.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Fit for you</td>
          {items.map((item) => (
            <td className="num" key={item.tool.id}>
              <b>{item.rating.total}</b> / 100
            </td>
          ))}
        </tr>
        <tr>
          <td>Price</td>
          {items.map((item) => (
            <td key={item.tool.id}>{item.tool.price}</td>
          ))}
        </tr>
        {CHECKS.map(({ key, label }) => (
          <tr key={key}>
            <td>{label}</td>
            {items.map((item) => {
              const [status, , note] = item.rating.checks[key];
              return (
                <td key={item.tool.id}>
                  <span className={`st ${status}`}>{STATUS_LABEL[status]}</span>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {note}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Render one tool's card: score, price, chips, the seven checks and its two actions. */
function ToolCard({
  businessId,
  item,
  workflow,
  comparing,
  onCompare,
}: {
  readonly businessId: string;
  readonly item: CompareItem;
  readonly workflow: WorkflowId;
  readonly comparing: boolean;
  readonly onCompare: () => void;
}) {
  const { tool, rating, owned, inStack } = item;
  const workflowName = WORKFLOWS[workflow].name.toLowerCase();
  const request: SetChoiceRequest = { workflow, path: owned ? "turnon" : "buy", toolId: tool.id };
  return (
    <article className="tool">
      <div className="score">
        {rating.total}
        <small>fit for you</small>
      </div>
      <div style={{ minWidth: 0 }}>
        <h3>{item.name}</h3>
        <p className="meta">{tool.price}</p>
        <div className="chips" style={{ marginTop: 6 }}>
          {item.workflows.map((w) => (
            <span className="chip" key={w}>
              {WORKFLOWS[w].name}
            </span>
          ))}
          {owned && <span className="chip ok">You already use it</span>}
          {tool.ai === true && <span className="chip ok">AI on the job</span>}
          {tool.ai === false && <span className="chip">No AI</span>}
          {tool.ai === null && <span className="chip">AI not stated</span>}
        </div>
        <p className="small" style={{ marginTop: 8, color: "var(--ink-2)" }}>
          Meets {rating.met} of {CHECKS.length} checks. {rating.unknown} not known yet.
        </p>
        <details>
          <summary>See the seven checks</summary>
          <CheckGrid rating={rating} />
          <p className="tiny muted" style={{ marginTop: 8 }}>
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
      <div className="acts">
        <ChooseButton businessId={businessId} request={request} className={`btn sm${inStack ? " ghost" : ""}`}>
          {inStack ? "In your stack" : owned ? `Turn on for ${workflowName}` : `Choose for ${workflowName}`}
        </ChooseButton>
        <button type="button" className="btn sm ghost" aria-pressed={comparing} onClick={onCompare}>
          {comparing ? "Comparing" : "Compare"}
        </button>
      </div>
    </article>
  );
}

/** Render the compare notice, the side-by-side table and every tool that matches `filter`. */
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
  const tableRef = useRef<HTMLDivElement>(null);
  const toggled = useRef(false);

  // Bring the table into view after a toggle, as the prototype did, but not on a filter change.
  useEffect(() => {
    if (toggled.current && compared.length >= 2) tableRef.current?.scrollIntoView({ block: "nearest" });
    toggled.current = false;
  }, [compared]);

  function toggle(id: string) {
    toggled.current = true;
    setCompared((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-MAX_COMPARED),
    );
  }

  // The table looks up every rated tool, so a compared tool stays in it when the filter hides its card.
  const byId = new Map(items.map((item) => [item.tool.id, item]));
  const comparedItems = compared.flatMap((id) => byId.get(id) ?? []);
  const visible = filter === "all" ? items : items.filter((item) => item.workflows.includes(filter));

  return (
    <>
      {comparedItems.length === 1 && (
        <p className="notice" style={{ marginBottom: 14 }}>
          Pick one more tool to compare side by side.
        </p>
      )}
      {comparedItems.length >= 2 && (
        <div className="scroll cmp" ref={tableRef}>
          <SideBySide items={comparedItems} />
        </div>
      )}
      <div className="tools">
        {visible.length === 0 ? (
          <p className="panel">
            No catalog tool covers this workflow yet. That&apos;s a gap Anchored can build an agent for.
          </p>
        ) : (
          visible.map((item) => {
            // A choice from "All" goes to the first of the business's workflows the tool covers.
            const workflow = filter === "all" ? item.workflows[0] : filter;
            // Unreachable: the compare page only sends tools that cover one of the business's workflows.
            if (workflow === undefined) return null;
            return (
              <ToolCard
                key={item.tool.id}
                businessId={businessId}
                item={item}
                workflow={workflow}
                comparing={compared.includes(item.tool.id)}
                onCompare={() => toggle(item.tool.id)}
              />
            );
          })
        )}
      </div>
    </>
  );
}
