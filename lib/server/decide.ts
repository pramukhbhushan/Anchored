import "server-only";
import { followupStillAllowed } from "@/lib/server/agent-work";
import type { CardRecord, DecideCardRequest, DecideCardResponse, OutboxEntry } from "@/lib/api/contract";
import { candidateFor, confirmAll, mergeCandidate } from "@/lib/domain/details";
import { checkSend, OWNER_TIME_ZONE, ensureOptOut, sendTimeText } from "@/lib/domain/executor";
import type { CardDraft } from "@/lib/domain/types";
import { getStore, type Store } from "@/lib/store";
import { dispatchEntry, planDelivery } from "@/lib/server/dispatch";

// =============================================================================
// Module Overview
// =============================================================================
// Applies an owner's decision to a card. Plain code, not the model, sends: the
// executor's `checkSend` rules run first, and a text blocked only by quiet
// hours is queued for the first allowed hour instead of sent now. The outbox
// entry says who sends it: Anchored through a connected service, which
// `lib/server/dispatch.ts` does, or the owner from their own phone or email.
// Every entry stands behind a card the owner approved. The card route calls
// `decideAndSend`, which also sends a message that is due now, and the rewrite
// route saves the model's redraft through `saveRewrite`.

const HOUR_MS = 60 * 60 * 1000;

/** Result of a decision: the response to send, or a conflict to report. */
type DecisionResult = { ok: true; response: DecideCardResponse } | { ok: false; status: number; error: string };

/** Return the first whole hour within a day when `checkSend` allows the card, or `null`. */
function nextAllowedHour(card: CardDraft, now: Date): Date | null {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let hours = 1; hours <= 24; hours += 1) {
    const candidate = new Date(start.getTime() + hours * HOUR_MS);
    // Drafted contacts come with consent; once contacts are imported, each carries its own consent record.
    if (checkSend(card, { now: candidate, timeZone: OWNER_TIME_ZONE, hasConsent: true }).ok) return candidate;
  }
  return null;
}

/** Write the outbox entry for an approved card at `sentAt`, queued for Anchored to send when a connected service can. */
async function send(store: Store, session: string, card: CardRecord, body: string, sentAt: Date): Promise<OutboxEntry | undefined> {
  // Neither kind sends: a locked card is the owner's to answer, and a flag card asks the owner for a fact.
  if (card.channel === "locked" || card.channel === "flag") return undefined;
  // A list card's body is what the owner keeps, such as a post to copy, so the outbox logs it with any edits.
  const text = card.channel === "list" ? `${card.action}: ${body}` : body;
  const to = card.to ?? "customer";
  const plan = await planDelivery(store, session, card.businessId, { channel: card.channel, to });
  return store.addOutbox(session, {
    businessId: card.businessId,
    cardId: card.id,
    channel: card.channel,
    to,
    body: text,
    sentAt: sentAt.toISOString(),
    delivery: plan.by === "anchored" ? "queued" : "yours",
    note: plan.by === "owner" ? plan.reason : null,
  });
}

/** Save an approved mapped body edit as an owner-confirmed profile fact. */
async function applyMappedEdit(store: Store, session: string, card: CardRecord, body: string): Promise<void> {
  const field = card.editMap?.body;
  if (field === undefined || body === card.body) return;
  const candidate = candidateFor(field, body, "owner", "high");
  if (candidate === null) return;
  const business = await store.getBusiness(session, card.businessId);
  if (business === null) return;
  const merged = confirmAll(mergeCandidate({ details: business.details ?? {}, evidence: business.evidence ?? {} }, candidate));
  await store.saveBusiness(session, { ...business, details: merged.details, evidence: merged.evidence }, "card_edit");
}

const ALREADY_DECIDED: DecisionResult = { ok: false, status: 409, error: "This card was already decided." };

/** Apply the owner's decision on the deployment's store, and send a message that is due now before returning. */
export async function decideAndSend(session: string, card: CardRecord, request: DecideCardRequest, now: Date): Promise<DecisionResult> {
  const store = getStore();
  const result = await decideCard(store, session, card, request, now);
  if (!result.ok) return result;
  const queued = result.response.outbox;
  // A message due now goes out at once; one held for quiet hours waits for the scheduled sender.
  if (queued?.delivery !== "queued" || queued.sentAt > now.toISOString()) return result;
  await dispatchEntry(store, session, queued.id, now);
  const outbox = (await store.listOutbox(session, card.businessId)).find((entry) => entry.id === queued.id) ?? queued;
  return { ok: true, response: { ...result.response, outbox } };
}

/** Save a rewritten body on a card that is still pending and mark it edited, or return `null` when the owner decided it meanwhile. */
export async function saveRewrite(session: string, cardId: string, body: string): Promise<CardRecord | null> {
  return getStore().updatePendingCard(session, cardId, { body, edited: true });
}

/** Apply `request` to a pending `card` and return what changed. */
export async function decideCard(store: Store, session: string, card: CardRecord, request: DecideCardRequest, now = new Date()): Promise<DecisionResult> {
  if (card.status !== "pending") return ALREADY_DECIDED;
  const decidedAt = now.toISOString();
  // Every status change goes through `updatePendingCard`: when two taps race, only the first one decides and sends.

  if (request.decision === "skip") {
    const skipped = await store.updatePendingCard(session, card.id, { status: "skipped", decidedAt });
    return skipped ? { ok: true, response: { card: skipped } } : ALREADY_DECIDED;
  }

  if (card.recordedFollowup !== undefined) {
    const business = await store.getBusiness(session, card.businessId);
    if (business === null || !(await followupStillAllowed(store, session, business, card, now))) return { ok: false, status: 409, error: "This follow-up's facts changed or it was canceled. Refresh before deciding." };
  }

  // The opt-out line is the law's job, not the owner's: code puts it back if an edit dropped it.
  const shown = request.body ?? card.body;
  const body = card.channel === "sms" ? ensureOptOut(shown) : shown;
  const edited = card.edited || body !== card.body;
  const draft: CardDraft = { ...card, body };

  if (card.channel === "locked" || card.channel === "flag") {
    const handled = await store.updatePendingCard(session, card.id, { status: "approved", decidedAt });
    return handled ? { ok: true, response: { card: handled } } : ALREADY_DECIDED;
  }

  const check = checkSend(draft, { now, timeZone: OWNER_TIME_ZONE, hasConsent: true });
  if (check.ok) {
    const approved = await store.updatePendingCard(session, card.id, { status: "approved", body, edited, decidedAt });
    if (!approved) return ALREADY_DECIDED;
    await applyMappedEdit(store, session, card, body);
    return { ok: true, response: { card: approved, outbox: await send(store, session, approved, body, now) } };
  }

  // Quiet hours delay a text; any other rule refuses it until the owner changes the draft.
  const later = nextAllowedHour(draft, now);
  if (!later) {
    if (edited) await store.updatePendingCard(session, card.id, { body, edited });
    const stillPending = await store.getCard(session, card.id);
    return { ok: true, response: { card: stillPending ?? card, blocked: check.reason } };
  }
  const queued = await store.updatePendingCard(session, card.id, { status: "approved", body, edited, decidedAt });
  if (!queued) return ALREADY_DECIDED;
  await applyMappedEdit(store, session, card, body);
  const outbox = await send(store, session, queued, body, later);
  return { ok: true, response: { card: queued, outbox, blocked: `${check.reason} Queued for ${sendTimeText(later)}.` } };
}
