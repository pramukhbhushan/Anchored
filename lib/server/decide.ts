import "server-only";
import type { CardRecord, DecideCardRequest, DecideCardResponse, OutboxEntry } from "@/lib/api/contract";
import { checkSend, OWNER_TIME_ZONE, ensureOptOut, sendTimeText } from "@/lib/domain/executor";
import type { CardDraft } from "@/lib/domain/types";
import type { Store } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Applies an owner's decision to a card. Plain code, not the model, sends: the
// executor's `checkSend` rules run first, and a text blocked only by quiet
// hours is queued for the first allowed hour instead of sent now.

const HOUR_MS = 60 * 60 * 1000;

/** Result of a decision: the response to send, or a conflict to report. */
export type DecisionResult = { ok: true; response: DecideCardResponse } | { ok: false; status: number; error: string };

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

/** Write the outbox entry for an approved card at `sentAt`. */
async function send(store: Store, session: string, card: CardRecord, body: string, sentAt: Date): Promise<OutboxEntry | undefined> {
  if (card.channel === "locked") return undefined;
  // A list card's body is what the owner keeps, such as a post to copy, so the outbox logs it with any edits.
  const text = card.channel === "list" ? `${card.action}: ${body}` : body;
  return store.addOutbox(session, { businessId: card.businessId, cardId: card.id, channel: card.channel, to: card.to ?? "customer", body: text, sentAt: sentAt.toISOString() });
}

const ALREADY_DECIDED: DecisionResult = { ok: false, status: 409, error: "This card was already decided." };

/** Apply `request` to a pending `card` and return what changed. */
export async function decideCard(store: Store, session: string, card: CardRecord, request: DecideCardRequest, now = new Date()): Promise<DecisionResult> {
  if (card.status !== "pending") return ALREADY_DECIDED;
  const decidedAt = now.toISOString();
  // Every status change goes through `updatePendingCard`: when two taps race, only the first one decides and sends.

  if (request.decision === "skip") {
    const skipped = await store.updatePendingCard(session, card.id, { status: "skipped", decidedAt });
    return skipped ? { ok: true, response: { card: skipped } } : ALREADY_DECIDED;
  }

  // The opt-out line is the law's job, not the owner's: code puts it back if an edit dropped it.
  const shown = request.body ?? card.body;
  const body = card.channel === "sms" ? ensureOptOut(shown) : shown;
  const edited = card.edited || body !== card.body;
  const draft: CardDraft = { ...card, body };

  if (card.channel === "locked") {
    const handled = await store.updatePendingCard(session, card.id, { status: "approved", decidedAt });
    return handled ? { ok: true, response: { card: handled } } : ALREADY_DECIDED;
  }

  const check = checkSend(draft, { now, timeZone: OWNER_TIME_ZONE, hasConsent: true });
  if (check.ok) {
    const approved = await store.updatePendingCard(session, card.id, { status: "approved", body, edited, decidedAt });
    if (!approved) return ALREADY_DECIDED;
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
  const outbox = await send(store, session, queued, body, later);
  return { ok: true, response: { card: queued, outbox, blocked: `${check.reason} Queued for ${sendTimeText(later)}.` } };
}
