import { isLiveEventKey, standingKey, type CardSkill } from "@/lib/domain/cards";
import { chosenSkills } from "@/lib/domain/paths";
import type { BusinessProfile, CardDraft, ChoiceMap } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Which starter drafts a business gets and when they give way to real work.
// `starterSkills` picks the chosen skills the model may write for, most useful
// first; `startersDue` says whether any of them still shows only a template;
// `examplesHidden` says when real cards from a connected channel take over.

/** Skills the model may write a starter for, most useful to a new owner first. */
export const WRITABLE_SKILLS = [
  "inquiry",
  "callback",
  "showup",
  "catering",
  "closer",
  "callfollow",
  "reviewer",
  "referral",
  "nudger",
  "posts",
  "reviewdrafter",
] as const satisfies readonly CardSkill[];

// Triage, licenses, price checks, stock counts, renewals, win-back sends and voice notes stay templates: their
// cards rest on dates, counts and amounts no profile holds, and the model may not invent them.

/** A skill the model may write a starter for. */
export type WritableSkill = (typeof WRITABLE_SKILLS)[number];

/** Most starters a business gets written, so a new owner reads a handful, not a wall. */
export const STARTER_LIMIT = 4;

/** Who a starter goes to: one customer by name, or nobody, for a post or reply the owner copies. */
type Recipient = "person" | "none";

/** Who each writable skill's card goes to. Code decides it; the model's name becomes the recipient of a `person` card only. */
export const STARTER_RECIPIENT: Readonly<Record<WritableSkill, Recipient>> = {
  inquiry: "person",
  callback: "person",
  showup: "person",
  catering: "person",
  closer: "person",
  callfollow: "person",
  reviewer: "person",
  referral: "person",
  nudger: "person",
  posts: "none",
  reviewdrafter: "none",
};

/**
 * The skills that get a written starter: chosen in the plan, with no researched card, in `WRITABLE_SKILLS` order,
 * at most `STARTER_LIMIT`. The example business keeps its researched cards, so it gets none.
 */
export function starterSkills(business: BusinessProfile, choices: ChoiceMap): WritableSkill[] {
  if (business.kind !== "custom") return [];
  const chosen = new Set(chosenSkills(business, choices));
  return WRITABLE_SKILLS.filter((skill) => chosen.has(skill) && business.cards?.[skill] === undefined).slice(0, STARTER_LIMIT);
}

/** A stored card as these rules read it. */
type StoredCard = Pick<CardDraft, "example"> & { readonly key: string };

/** Whether real work has taken over: a channel is connected and a real outside event has produced a card. */
export function examplesHidden(stored: readonly StoredCard[], connected: boolean): boolean {
  return connected && stored.some((card) => isLiveEventKey(card.key));
}

/** Whether a starter skill still shows only its template, so its starter should be written now. */
export function startersDue(business: BusinessProfile, choices: ChoiceMap, stored: readonly StoredCard[], connected: boolean): boolean {
  if (examplesHidden(stored, connected)) return false;
  const keys = new Set(stored.map((card) => card.key));
  return starterSkills(business, choices).some((skill) => !keys.has(standingKey(business.id, skill)));
}
