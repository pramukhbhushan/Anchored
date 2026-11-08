import { resolveChoices, stackCost, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, ChoiceMap, WorkflowId } from "@/lib/domain/types";
import { WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The morning brief Internal Communications writes for the owner. `morningBrief`
// reads the feed and the stack and returns a few plain lines: what waits, what
// rides on it, which new workflows are on, and what the stack costs. The
// overview draws the same facts from `stakeWaiting`, `samplesWaiting` and
// `newForOwner`, so a dollar figure never comes from an example card.

/** What the brief reads from each card in the feed. */
export interface BriefCard {
  // Mirrors `CardStatus` in `lib/api/contract.ts`, which this layer can't import.
  readonly status: "pending" | "approved" | "skipped" | "superseded";
  readonly stake?: number;
  readonly title: string;
  /** Set on an owner's starter drafts, whose names and dollars are made up to show the card. */
  readonly example?: true;
}

/** Dollars on the waiting cards, leaving out example cards' made-up figures. */
export function stakeWaiting(cards: readonly BriefCard[]): number {
  return cards.filter((card) => card.status === "pending" && card.example !== true).reduce((sum, card) => sum + (card.stake ?? 0), 0);
}

/** Dollars on the cards the owner approved, leaving out example cards' made-up figures. */
export function stakeActedOn(cards: readonly (BriefCard & { readonly channel: string })[]): number {
  // A locked card is decided by "I'll handle it", and a flag card asks the owner for a fact: neither approves a draft.
  return cards
    .filter((card) => card.status === "approved" && card.channel !== "locked" && card.channel !== "flag" && card.example !== true)
    .reduce((sum, card) => sum + (card.stake ?? 0), 0);
}

/** How many waiting cards are examples rather than drafts from the owner's own events or requests. */
export function samplesWaiting(cards: readonly BriefCard[]): number {
  return cards.filter((card) => card.status === "pending" && card.example === true).length;
}

/** Workflows the rules marked as new ground for this owner, such as posting when they never said they post, unless skipped. */
export function newForOwner(business: BusinessProfile, choices: ChoiceMap): WorkflowId[] {
  const resolved = resolveChoices(business, choices);
  return workflowIdsOf(business).filter((id) => business.workflows[id]?.isNew === true && resolved[id].path !== "skip");
}

/** The morning brief as short lines, most urgent first. */
export function morningBrief(business: BusinessProfile, choices: ChoiceMap, cards: readonly BriefCard[]): string[] {
  const pending = cards.filter((card) => card.status === "pending");
  const [first] = pending;
  const atStake = stakeWaiting(cards);
  const fresh = newForOwner(business, choices).map((id) => WORKFLOWS[id].name);
  const cost = stackCost(business, choices);

  const lines: string[] = [];
  lines.push(
    first === undefined
      ? "Nothing waits for you. Every card is decided."
      : `${pending.length} ${pending.length === 1 ? "card waits" : "cards wait"} for you. First up: ${first.title}.`,
  );
  if (atStake !== 0) lines.push(`${formatMoney(atStake)} in quotes, invoices or orders rides on today's cards.`);
  if (fresh.length > 0) lines.push(`New for you: ${fresh.join(", ")}.`);
  const quoted = cost.onQuote.length > 0 ? `, plus ${cost.onQuote.map((tool) => tool.name).join(" and ")} on quote` : "";
  lines.push(`Your stack costs ${formatMoney(cost.total)} a month${quoted}.`);
  return lines;
}

/** Dollars with thousands separators and at most two decimals, such as "$1,248" or "$59.95". */
function formatMoney(amount: number): string {
  return `$${(Math.round(amount * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
