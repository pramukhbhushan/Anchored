import { isOwnersOwn } from "@/lib/domain/origin";
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
// `newForOwner`, so a dollar figure only ever comes from the owner's own events.

/** What the brief reads from each card in the feed. */
export interface BriefCard {
  readonly key: string;
  readonly status: "pending" | "approved" | "skipped";
  readonly stake?: number;
  readonly title: string;
}

/** What the brief reads from the business. */
type BriefBusiness = Pick<BusinessProfile, "kind">;

/** Whether a card's dollars and names are real for this business: the example's are researched, an owner's come from their events. */
function counts(business: BriefBusiness, card: Pick<BriefCard, "key">): boolean {
  return business.kind === "case" || isOwnersOwn(card.key);
}

/** Dollars on the waiting cards, counting only the cards whose figure is real for this business. */
export function stakeWaiting(business: BriefBusiness, cards: readonly BriefCard[]): number {
  return cards.filter((card) => card.status === "pending" && counts(business, card)).reduce((sum, card) => sum + (card.stake ?? 0), 0);
}

/** Dollars on the cards the owner approved, counting only the cards whose figure is real for this business. */
export function stakeActedOn(business: BriefBusiness, cards: readonly (BriefCard & { readonly channel: string })[]): number {
  // A locked card is decided by "I'll handle it", which takes the work back rather than approving a draft.
  return cards
    .filter((card) => card.status === "approved" && card.channel !== "locked" && counts(business, card))
    .reduce((sum, card) => sum + (card.stake ?? 0), 0);
}

/** How many waiting cards in an owner's business are samples rather than drafts from their own events or requests. */
export function samplesWaiting(business: BriefBusiness, cards: readonly BriefCard[]): number {
  if (business.kind === "case") return 0;
  return cards.filter((card) => card.status === "pending" && !isOwnersOwn(card.key)).length;
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
  const atStake = stakeWaiting(business, cards);
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
