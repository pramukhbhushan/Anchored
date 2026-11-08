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

// =============================================================================
// The daily brief's snapshot
// =============================================================================

/** A card as the snapshot reads it. */
export interface SnapshotCard extends BriefCard {
  readonly key: string;
  readonly channel: string;
  readonly skill: string | null;
  readonly createdAt: string;
}

/** An outbox entry as the snapshot reads it. */
export interface SnapshotSend {
  readonly delivery: "yours" | "queued" | "sending" | "sent" | "failed";
  readonly channel: string;
  readonly sentAt: string;
}

/** What one brief counted, all by code. Every number the owner reads comes from here. */
export interface BriefSnapshot {
  /** The window's start, the last successful brief; `null` for a first brief, which counts everything so far. */
  readonly from: string | null;
  readonly to: string;
  readonly waiting: number;
  /** Dollars on the waiting cards, leaving out example cards' made-up figures. */
  readonly waitingStake: number;
  readonly examplesWaiting: number;
  /** Up to three waiting cards, most dollars first, then oldest. */
  readonly top: readonly { readonly title: string; readonly stake?: number }[];
  /** Every waiting card that asks the owner to act personally, such as an allergy question. Never cut short. */
  readonly flags: readonly string[];
  readonly newCards: number;
  readonly sent: number;
  readonly queued: number;
  readonly failed: number;
  /** Customers who sent STOP or /stop, or blocked the bot, in the window. */
  readonly stops: number;
}

/** What the snapshot reads. Brief cards themselves are left out, so a brief never counts the brief before it. */
export interface SnapshotInput {
  readonly cards: readonly SnapshotCard[];
  readonly outbox: readonly SnapshotSend[];
  readonly optedOutAt: readonly (string | null)[];
  readonly since: string | null;
  readonly now: string;
}

/** Count the business's state for one brief. */
export function briefSnapshot(input: SnapshotInput): BriefSnapshot {
  const { since, now } = input;
  const inWindow = (at: string) => (since === null || at > since) && at <= now;
  const cards = input.cards.filter((card) => card.skill !== "brief");
  const pending = cards.filter((card) => card.status === "pending");
  const real = pending.filter((card) => card.example !== true);
  const top = [...real]
    .sort((a, b) => (b.stake ?? 0) - (a.stake ?? 0) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 3)
    .map((card) => (card.stake === undefined ? { title: card.title } : { title: card.title, stake: card.stake }));
  const sends = input.outbox.filter((entry) => inWindow(entry.sentAt));
  return {
    from: since,
    to: now,
    waiting: pending.length,
    waitingStake: stakeWaiting(cards),
    examplesWaiting: samplesWaiting(cards),
    top,
    flags: pending.filter((card) => card.channel === "locked" || card.channel === "flag").map((card) => card.title),
    newCards: cards.filter((card) => inWindow(card.createdAt)).length,
    sent: sends.filter((entry) => entry.delivery === "sent").length,
    queued: input.outbox.filter((entry) => entry.delivery === "queued").length,
    failed: sends.filter((entry) => entry.delivery === "failed").length,
    stops: input.optedOutAt.filter((at): at is string => at !== null && inWindow(at)).length,
  };
}

/** The brief as short plain lines, the one thing that matters most first. Every number comes from `snapshot`. */
export function briefLines(snapshot: BriefSnapshot): string[] {
  const lines: string[] = [];
  const [first] = snapshot.top;
  if (snapshot.flags.length > 0) {
    lines.push(`${snapshot.flags.length === 1 ? "1 needs" : `${snapshot.flags.length} need`} you personally: ${snapshot.flags.join("; ")}.`);
  }
  if (snapshot.waiting === 0) {
    lines.push("Nothing waits for your OK.");
  } else {
    const worth = snapshot.waitingStake > 0 ? `, worth about ${formatMoney(snapshot.waitingStake)}` : "";
    lines.push(`${snapshot.waiting} ${snapshot.waiting === 1 ? "draft waits" : "drafts wait"} for your OK${worth}.${first === undefined ? "" : ` Start with: ${first.title}.`}`);
  }
  if (snapshot.examplesWaiting > 0) lines.push(`${snapshot.examplesWaiting} of them ${snapshot.examplesWaiting === 1 ? "is an example" : "are examples"}, with made-up names and amounts.`);
  const since = snapshot.from === null ? "So far" : "Since your last brief";
  const done = [
    snapshot.newCards > 0 ? `${snapshot.newCards} new ${snapshot.newCards === 1 ? "draft" : "drafts"}` : null,
    snapshot.sent > 0 ? `${snapshot.sent} sent` : null,
    snapshot.failed > 0 ? `${snapshot.failed} failed to send` : null,
    snapshot.stops > 0 ? `${snapshot.stops} ${snapshot.stops === 1 ? "customer" : "customers"} asked to stop getting messages` : null,
  ].filter((part) => part !== null);
  lines.push(done.length === 0 ? `${since}: nothing new.` : `${since}: ${done.join(", ")}.`);
  if (snapshot.queued > 0) lines.push(`${snapshot.queued} approved ${snapshot.queued === 1 ? "message waits" : "messages wait"} to send, such as replies held for quiet hours.`);
  return lines;
}
