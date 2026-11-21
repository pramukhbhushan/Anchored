import "server-only";
import { canDeleteTelegram } from "@/lib/server/dispatch";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { CardRecord, ChatMessage, EventCardResponse, OutboxEntry } from "@/lib/api/contract";
import { STANDING_SKILLS } from "@/lib/domain/agents";
import { draftFeed } from "@/lib/domain/cards";
import { isSampleBusinessId, SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { isService } from "@/lib/domain/connections";
import { chosenSkills, resolveChoices, workflowIdsOf } from "@/lib/domain/paths";
import { examplesHidden, startersDue } from "@/lib/domain/starters";
import type { BusinessProfile, Choice, ChoiceMap, KeyedCard, SkillId, WorkflowId } from "@/lib/domain/types";
import { getStore } from "@/lib/store";
import type { ProfileVersion } from "@/lib/store/types";
import { llmFromConnections } from "./ai-budget";
import { getSessionId } from "./session";
import { isWritingStarters, scheduleStarters } from "./starters";

// =============================================================================
// Module Overview
// =============================================================================
// Server-side reads for pages and API routes. The example business comes from code; a
// session's own businesses, choices and cards come from the `Store`. `getFeed`
// also syncs card drafts for the agents the owner has chosen, and `resetSession`
// clears the session's rows when the owner deletes their businesses.

/** Delete the session's businesses, choices, cards, outbox and chat. The example business lives in code and stays. */
export async function resetSession(session: string): Promise<void> {
  await getStore().reset(session);
}

// `cache` reads the list once per server render: the shell layout and the `/app` page both ask for it.
/** Return the example business, then the session's own businesses. */
export const listBusinesses = cache(async (): Promise<BusinessProfile[]> => {
  const session = await getSessionId();
  return [SAMPLE_BUSINESS, ...(await getStore().listBusinesses(session))];
});

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

// `cache` reads each business's choices once per server render: a page that shows
// both the paths and the feed would otherwise read them twice.
const savedChoices = cache(async (businessId: string) => getStore().getChoices(await getSessionId(), businessId));

/** Return the chosen path for each of the business's workflows, filling in Anchored's picks. */
export async function getChoices(business: BusinessProfile): Promise<Record<WorkflowId, Choice>> {
  return resolveChoices(business, await savedChoices(business.id));
}

/** Return only the picks the owner saved for the business, which `planStatus` compares with the approved ones. */
export async function getSavedChoices(business: BusinessProfile): Promise<ChoiceMap> {
  return savedChoices(business.id);
}

/** Return the saved versions of the owner's business, newest first. The example has no history. */
export async function getProfileVersions(business: BusinessProfile): Promise<ProfileVersion[]> {
  if (isSampleBusinessId(business.id)) return [];
  return getStore().listProfileVersions(await getSessionId(), business.id);
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

/** The next simulation number after `cards`, which picks the template variant and agent rotation. */
export function simulationTurn(cards: readonly Pick<CardRecord, "key">[]): number {
  return cards.filter((card) => card.key.includes(":sim:")).length + 1;
}

/** Return the next simulation number for a business. */
export async function nextSimulationTurn(businessId: string): Promise<number> {
  return simulationTurn(await getStore().listCards(await getSessionId(), businessId));
}

/** `key` with a random suffix, so two events arriving together never share a card key. */
export function uniqueEventKey(key: string): string {
  // The turn number alone can collide when a simulate and an ingest race; the random suffix can't.
  return `${key}-${randomUUID().slice(0, 8)}`;
}

/** Store a new event card and return the feed along with the stored card. */
export async function addEventCard(business: BusinessProfile, card: KeyedCard): Promise<EventCardResponse> {
  const session = await getSessionId();
  const store = getStore();
  const unique = { ...card, key: uniqueEventKey(card.key) };
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

/** A business's feed, and whether its example cards are still the ones to show. */
interface Feed {
  readonly cards: CardRecord[];
  readonly outbox: OutboxEntry[];
  /** Whether the business has connected a texting number, email or Stripe. */
  readonly connected: boolean;
  /** Whether real cards from a connected channel have replaced the examples. */
  readonly examplesHidden: boolean;
  /** Whether starters are being written for this business, so the page should look again shortly. */
  readonly writingStarters: boolean;
}

/**
 * Return the cards for the business's chosen skills and its outbox. Writes nothing itself; when the business still
 * shows template starters and AI is on, it schedules them to be written after the response.
 */
export async function getFeed(business: BusinessProfile): Promise<Feed> {
  const session = await getSessionId();
  const store = getStore();
  // The reads don't depend on each other, so the page waits for one database round trip, not four.
  const [choices, stored, outbox, connections] = await Promise.all([
    getChoices(business),
    store.listCards(session, business.id),
    store.listOutbox(session, business.id),
    store.listConnections(session, business.id),
  ]);
  // An AI key moves no messages, so it doesn't count as a connected channel.
  const connected = connections.some((connection) => isService(connection.kind));
  const hidden = examplesHidden(stored, connected);
  const storedKeys = new Set(stored.map((card) => card.key));
  const virtual: CardRecord[] = draftFeed(business, choices)
    .filter((draft) => !storedKeys.has(draft.key))
    .map((draft) => ({ ...draft, id: virtualCardId(draft.key), businessId: business.id, status: "pending", edited: false, createdAt: STANDING_DRAFT_TIME, decidedAt: null }));
  const live = liveSkills(business, choices);
  // A pending card for a skill the owner switched away from is hidden until it switches back, and a pending
  // example once real cards took over; decided cards stay, so the history and its counts don't change.
  const cards = [...stored, ...virtual].filter(
    (card) => card.status !== "pending" || (card.skill !== null && live.has(card.skill) && !(hidden && card.example === true)),
  );
  const due = llmFromConnections(connections) !== null && startersDue(business, choices, stored, connected);
  if (due) scheduleStarters(session, business);
  return { cards: cards.sort(feedOrder), outbox: outbox.map((entry) => { const { providerId: _provider, ...publicEntry } = entry; return { ...publicEntry, canDeleteTelegram: business.kind === "custom" && canDeleteTelegram(entry, new Date()) }; }), connected, examplesHidden: hidden, writingStarters: due || isWritingStarters(session, business.id) };
}

// Standing drafts sort below every real event: new calls, leads and invoices should lead the feed.
const STANDING_DRAFT_TIME = new Date(0).toISOString();

/** Skills whose cards can be acted on now: the chosen build skills, plus the brief and triage, which always run. */
function liveSkills(business: BusinessProfile, choices: Record<WorkflowId, Choice>): Set<SkillId> {
  return new Set<SkillId>([...chosenSkills(business, choices), ...STANDING_SKILLS]);
}

/** Report whether `card` can still be decided: its skill is chosen now, so its agent is working. */
export async function isCardLive(card: CardRecord): Promise<boolean> {
  const business = await findBusiness(card.businessId);
  if (!business || card.skill === null) return false;
  return liveSkills(business, await getChoices(business)).has(card.skill);
}

/** The onboarding chat that set up `business`, oldest message first, or none for a business built from the form or an example. */
export async function getSetupChat(business: BusinessProfile): Promise<ChatMessage[]> {
  if (business.kind === "case") return [];
  const session = await getSessionId();
  const store = getStore();
  const intake = await store.findIntakeByBusiness(session, business.id);
  return intake === null ? [] : store.listMessages(session, { kind: "intake", id: intake.id }, 200);
}
