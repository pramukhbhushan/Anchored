import { resolveChoices, stackCost, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, ChoiceMap } from "@/lib/domain/types";
import { WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The morning brief Internal Communications writes for the owner. `morningBrief`
// reads the feed and the stack and returns a few plain lines: what waits, what
// rides on it, which new workflows are on, and what the stack costs.

/** What the brief reads from each card in the feed. */
export interface BriefCard {
  readonly status: "pending" | "approved" | "skipped";
  readonly stake?: number;
  readonly title: string;
}

/** The morning brief as short lines, most urgent first. */
export function morningBrief(business: BusinessProfile, choices: ChoiceMap, cards: readonly BriefCard[]): string[] {
  const pending = cards.filter((card) => card.status === "pending");
  const [first] = pending;
  const atStake = pending.reduce((sum, card) => sum + (card.stake ?? 0), 0);
  const resolved = resolveChoices(business, choices);
  const fresh = workflowIdsOf(business)
    .filter((id) => business.workflows[id]?.isNew === true && resolved[id].path !== "skip")
    .map((id) => WORKFLOWS[id].name);
  const cost = stackCost(business, choices);

  const lines: string[] = [];
  lines.push(
    first === undefined
      ? "Nothing waits for you. Every card is decided."
      : `${pending.length} ${pending.length === 1 ? "card waits" : "cards wait"} for you. First up: ${first.title}.`,
  );
  if (atStake !== 0) lines.push(`${formatMoney(atStake)} in quotes, invoices or orders rides on today's cards.`);
  if (fresh.length > 0) lines.push(`New for you this week: ${fresh.join(", ")}.`);
  const quoted = cost.onQuote.length > 0 ? `, plus ${cost.onQuote.map((tool) => tool.name).join(" and ")} on quote` : "";
  lines.push(`Your stack costs ${formatMoney(cost.total)} a month${quoted}.`);
  return lines;
}

/** Dollars with thousands separators and at most two decimals, such as "$1,248" or "$59.95". */
function formatMoney(amount: number): string {
  return `$${(Math.round(amount * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
