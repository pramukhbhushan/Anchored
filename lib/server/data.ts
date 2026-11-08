import "server-only";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { CardRecord, EventCardResponse, OutboxEntry } from "@/lib/api/contract";
import { draftFeed } from "@/lib/domain/cards";
import { isSampleBusinessId, SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { chosenSkills, resolveChoices, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, KeyedCard, SkillId, WorkflowId } from "@/lib/domain/types";
import { getStore } from "@/lib/store";
import { getSessionId } from "./session";

// =============================================================================
// Module Overview
// =============================================================================
// Server-side reads for pages and API routes. The example business comes from code; a
// session's own businesses, choices and cards come from the `Store`. `getFeed`
// also syncs card drafts for the agents the owner has chosen.

/** Return the example business, then the session's own businesses. */
export async function listBusinesses(): Promise<BusinessProfile[]> {
  const session = await getSessionId();
  return [SAMPLE_BUSINESS, ...(await getStore().listBusinesses(session))];
}

// `cache` reads each id once per server render: the business layout and its page both look it up.
/** Return the example business or one of the session's businesses, or `null`. */
export const findBusiness = cache(async (id: string): Promise<BusinessProfile | null> => {
  if (isSampleBusinessId(id)) return SAMPLE_BUSINESS;
  return getStore().getBusiness(await getSessionId(), id);
});

/** Return the business for a page, or render the 404 page. */
export async function getBusinessOrNotFound(id: string): Promise<BusinessProfile> {
  const business = await findBusiness(id);
  if (!business) notFound();
  return business;
}

/** Return the chosen path for each of the business's workflows, filling in Anchored's picks. */
export async function getChoices(business: BusinessProfile): Promise<Record<WorkflowId, Choice>> {
  const saved = await getStore().getChoices(await getSessionId(), business.id);
  return resolveChoices(business, saved);
}

/** Narrow `choices` so only `skill` is built, letting a simulation target one skill. */
export function choicesForSkill(business: BusinessProfile, choices: Record<WorkflowId, Choice>, skill: SkillId): Record<WorkflowId, Choice> {
  const narrowed = { ...choices };
  for (const workflow of workflowIdsOf(business)) {
    const choice = choices[workflow];
    narrowed[workflow] = choice.path === "build" && choice.skills.includes(skill) ? { path: "build", skills: [skill] } : { path: "skip" };
  }
  return narrowed;
}

/** Return the next simulation number for a business, which picks the template variant and agent rotation. */
export async function nextSimulationTurn(businessId: string): Promise<number> {
  const cards = await getStore().listCards(await getSessionId(), businessId);
  return cards.filter((card) => card.key.includes(":sim:")).length + 1;
}

/** Give a new event card a key no other request can share, so two events arriving together both land. */
function uniqueEventKey(card: KeyedCard): KeyedCard {
  // The turn number alone can collide when a simulate and an ingest race; the random suffix can't.
  return { ...card, key: `${card.key}-${randomUUID().slice(0, 8)}` };
}

/** Store a new event card and return the feed along with the stored card. */
export async function addEventCard(business: BusinessProfile, card: KeyedCard): Promise<EventCardResponse> {
  const session = await getSessionId();
  const store = getStore();
  const unique = uniqueEventKey(card);
  await store.ensureCards(session, business.id, [unique]);
  const feed = await getFeed(business);
  return { ...feed, added: feed.cards.find((stored) => stored.key === unique.key) ?? null };
}

/** Order a feed: pending cards first, newest first, then decided cards, latest decision first. */
function feedOrder(a: CardRecord, b: CardRecord): number {
  const aPending = a.status === "pending";
  const bPending = b.status === "pending";
  if (aPending !== bPending) return aPending ? -1 : 1;
  const aTime = aPending ? a.createdAt : (a.decidedAt ?? a.createdAt);
  const bTime = bPending ? b.createdAt : (b.decidedAt ?? b.createdAt);
  return bTime.localeCompare(aTime);
}

// -----------------------------------------------------------------
// Virtual cards: drafts that exist only until the owner acts on one
// -----------------------------------------------------------------

// Drafts are computed from the business and its choices, so a page view never writes a row.
// A draft is stored the first time the owner approves, edits, skips or rewrites it.
const VIRTUAL_PREFIX = "v.";

/** Return the id a not-yet-stored draft carries, built from its stable key. */
export function virtualCardId(key: string): string {
  return VIRTUAL_PREFIX + key.replaceAll(":", "~");
}

/** Return the draft key inside a virtual card id, or `null` for a stored card's id. */
export function keyFromVirtualId(id: string): string | null {
  return id.startsWith(VIRTUAL_PREFIX) ? id.slice(VIRTUAL_PREFIX.length).replaceAll("~", ":") : null;
}

/** Report whether `id` has the shape of a card id: a stored UUID or a virtual draft id. */
export function isCardId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^v\.[A-Za-z0-9_~-]{1,160}$/.test(id);
}

/** Return the stored card for `id`, storing a virtual draft first so it can be decided. `null` when it doesn't exist. */
export async function materializeCard(id: string): Promise<CardRecord | null> {
  const session = await getSessionId();
  const store = getStore();
  const key = keyFromVirtualId(id);
  if (key === null) return store.getCard(session, id);

  const business = await findBusiness(key.split(":")[0] ?? "");
  if (!business) return null;
  const draft = draftFeed(business, await getChoices(business)).find((card) => card.key === key);
  if (!draft) return null;
  await store.ensureCards(session, business.id, [draft]);
  return (await store.listCards(session, business.id)).find((card) => card.key === key) ?? null;
}

/** Return the cards for the business's chosen skills and its simulated outbox. Reads only. */
export async function getFeed(business: BusinessProfile): Promise<{ cards: CardRecord[]; outbox: OutboxEntry[] }> {
  const session = await getSessionId();
  const store = getStore();
  const choices = await getChoices(business);
  const stored = await store.listCards(session, business.id);
  const storedKeys = new Set(stored.map((card) => card.key));
  const virtual: CardRecord[] = draftFeed(business, choices)
    .filter((draft) => !storedKeys.has(draft.key))
    .map((draft) => ({ ...draft, id: virtualCardId(draft.key), businessId: business.id, status: "pending", edited: false, createdAt: STANDING_DRAFT_TIME, decidedAt: null }));
  const live = liveSkills(business, choices);
  // A pending card for a skill the owner switched away from is hidden until it switches back;
  // decided cards stay, so the history and its counts don't change with the owner's paths.
  const cards = [...stored, ...virtual].filter((card) => card.status !== "pending" || (card.skill !== null && live.has(card.skill)));
  return { cards: cards.sort(feedOrder), outbox: await store.listOutbox(session, business.id) };
}

// Standing drafts sort below every real event: new calls, leads and invoices should lead the feed.
const STANDING_DRAFT_TIME = new Date(0).toISOString();

/** Skills whose cards can be acted on now: the chosen build skills, plus triage, which always runs. */
function liveSkills(business: BusinessProfile, choices: Record<WorkflowId, Choice>): Set<SkillId> {
  return new Set<SkillId>([...chosenSkills(business, choices), "triage"]);
}

/** Report whether `card` can still be decided: its skill is chosen now, so its agent is working. */
export async function isCardLive(card: CardRecord): Promise<boolean> {
  const business = await findBusiness(card.businessId);
  if (!business || card.skill === null) return false;
  return liveSkills(business, await getChoices(business)).has(card.skill);
}
