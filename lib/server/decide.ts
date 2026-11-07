import "server-only";
import type { CardRecord, DecideCardRequest, DecideCardResponse, OutboxEntry } from "@/lib/api/contract";
import { checkSend } from "@/lib/domain/executor";
import type { CardDraft } from "@/lib/domain/types";
import type { Store } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Applies an owner's decision to a card. Plain code, not the model, sends: the
// executor's `checkSend` rules run first, and a text blocked only by quiet
// hours is queued for the first allowed hour instead of sent now.

// Every demo business is in Maryland. A real account stores its own time zone.
const DEMO_TIME_ZONE = "America/New_York";
const HOUR_MS = 60 * 60 * 1000;

/** Result of a decision: the response to send, or a conflict to report. */
export type DecisionResult = { ok: true; response: DecideCardResponse } | { ok: false; status: number; error: string };

/** Return the first whole hour within a day when `checkSend` allows the card, or `null`. */
function nextAllowedHour(card: CardDraft, now: Date): Date | null {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let hours = 1; hours <= 24; hours += 1) {
    const candidate = new Date(start.getTime() + hours * HOUR_MS);
    // Demo contacts are seeded with consent; real contacts carry a consent record from import.
    if (checkSend(card, { now: candidate, timeZone: DEMO_TIME_ZONE, hasConsent: true }).ok) return candidate;
  }
  return null;
}

/** Format a queued send time the way the owner reads it, for example "Mon 8:00 AM". */
function formatLocal(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: DEMO_TIME_ZONE, weekday: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

/** Write the outbox entry for an approved card at `sentAt`. */
async function send(store: Store, session: string, card: CardRecord, body: string, sentAt: Date): Promise<OutboxEntry | undefined> {
  if (card.channel === "locked") return undefined;
  const text = card.channel === "list" ? `${card.action}: ${card.title}` : body;
  return store.addOutbox(session, { businessId: card.businessId, cardId: card.id, channel: card.channel, to: card.to ?? "customer", body: text, sentAt: sentAt.toISOString() });
}

/** Apply `request` to a pending `card` and return what changed. */
export async function decideCard(store: Store, session: string, card: CardRecord, request: DecideCardRequest, now = new Date()): Promise<DecisionResult> {
  if (card.status !== "pending") return { ok: false, status: 409, error: "This card was already decided." };
  const decidedAt = now.toISOString();

  if (request.decision === "skip") {
    const skipped = await store.updateCard(session, card.id, { status: "skipped", decidedAt });
    return { ok: true, response: { card: skipped } };
  }

  const body = request.body ?? card.body;
  const edited = card.edited || body !== card.body;
  const draft: CardDraft = { ...card, body };

  if (card.channel === "locked") {
    const handled = await store.updateCard(session, card.id, { status: "approved", decidedAt });
    return { ok: true, response: { card: handled } };
  }

  const check = checkSend(draft, { now, timeZone: DEMO_TIME_ZONE, hasConsent: true });
  if (check.ok) {
    const approved = await store.updateCard(session, card.id, { status: "approved", body, edited, decidedAt });
    return { ok: true, response: { card: approved, outbox: await send(store, session, approved, body, now) } };
  }

  // Quiet hours delay a text; any other rule refuses it until the owner changes the draft.
  const later = nextAllowedHour(draft, now);
  if (!later) {
    if (edited) await store.updateCard(session, card.id, { body, edited });
    const stillPending = await store.getCard(session, card.id);
    return { ok: true, response: { card: stillPending ?? card, blocked: check.reason } };
  }
  const queued = await store.updateCard(session, card.id, { status: "approved", body, edited, decidedAt });
  const outbox = await send(store, session, queued, body, later);
  return { ok: true, response: { card: queued, outbox, blocked: `${check.reason} Queued for ${formatLocal(later)}.` } };
}
