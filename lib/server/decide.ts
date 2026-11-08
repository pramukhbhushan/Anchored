import "server-only";
import type { CardRecord, DecideCardRequest, DecideCardResponse, OutboxEntry } from "@/lib/api/contract";
import type { Contact } from "@/lib/domain/contacts";
import { checkProtocolNotice, checkSend, OWNER_TIME_ZONE, ensureOptOut, sendTimeText } from "@/lib/domain/executor";
import { acknowledgmentKey, acknowledgmentText, ruleEnabled } from "@/lib/domain/rules";
import type { BusinessProfile, CardDraft } from "@/lib/domain/types";
import type { Store } from "@/lib/store";
import { planDelivery } from "@/lib/server/dispatch";

// =============================================================================
// Module Overview
// =============================================================================
// Applies an owner's decision to a card. Plain code, not the model, sends: the
// executor's `checkSend` rules run first, and a text blocked only by quiet
// hours is queued for the first allowed hour instead of sent now. The outbox
// entry says who sends it: Anchored through a connected service, which
// `lib/server/dispatch.ts` does, or the owner from their own phone or email.
// Two kinds of entry need no card: `queueProtocolNotice`, the bot's fixed
// answer to a customer's own /start or /stop, and `queueAcknowledgment`, the
// fixed "got your message" reply the owner approved once as a standing rule.
// Turning that rule off fails every acknowledgment still queued.

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

/** Write the outbox entry for an approved card at `sentAt`, queued for Anchored to send when a connected service can. */
async function send(store: Store, session: string, card: CardRecord, body: string, sentAt: Date): Promise<OutboxEntry | undefined> {
  // Neither kind sends: a locked card is the owner's to answer, and a flag card asks the owner for a fact.
  if (card.channel === "locked" || card.channel === "flag") return undefined;
  // A list card's body is what the owner keeps, such as a post to copy, so the outbox logs it with any edits.
  const text = card.channel === "list" ? `${card.action}: ${body}` : body;
  const to = card.to ?? "customer";
  // A Telegram card names its customer by contact id, since the chat id never leaves the server.
  const contactId = card.channel === "telegram" ? card.contact : undefined;
  const plan = await planDelivery(store, session, card.businessId, { channel: card.channel, to, contactId });
  return store.addOutbox(session, {
    businessId: card.businessId,
    cardId: card.id,
    channel: card.channel,
    to,
    body: text,
    sentAt: sentAt.toISOString(),
    delivery: plan.by === "anchored" ? "queued" : "yours",
    note: plan.by === "owner" ? plan.reason : null,
    ...(contactId === undefined ? {} : { contactId }),
  });
}

/**
 * Queue the bot's fixed answer to a customer's own /start or /stop, due at once, for `dispatchEntry` to send. Fixed text
 * the customer asked for, so no card stands behind it. Returns `null` when the text fails the content rules.
 */
export async function queueProtocolNotice(
  store: Store,
  session: string,
  notice: { readonly businessId: string; readonly contact: Contact; readonly body: string; readonly at: Date },
): Promise<OutboxEntry | null> {
  if (!checkProtocolNotice(notice.body).ok) return null;
  return store.addOutbox(session, {
    businessId: notice.businessId,
    cardId: null,
    channel: "telegram",
    to: notice.contact.name,
    contactId: notice.contact.id,
    body: notice.body,
    sentAt: notice.at.toISOString(),
    delivery: "queued",
    note: null,
    rule: "protocol",
  });
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

  if (card.channel === "locked" || card.channel === "flag") {
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

/**
 * Queue the fixed acknowledgment for a customer's Telegram message when the owner turned the `acknowledge` rule on.
 * At most one per customer per window, held for morning in quiet hours. Returns `null` when nothing was queued: the
 * rule is off, one already went out in this window, or the rules refuse it.
 */
export async function queueAcknowledgment(
  store: Store,
  session: string,
  ack: { readonly business: BusinessProfile; readonly contact: Contact; readonly at: Date },
): Promise<OutboxEntry | null> {
  const { business, contact, at } = ack;
  if (!ruleEnabled(await store.getStandingRules(session, business.id), "acknowledge")) return null;
  const body = acknowledgmentText(business.name);
  const draft: CardDraft = { agent: null, skill: null, title: "", body, reason: "", checks: [], action: "", channel: "telegram" };
  const check = checkSend(draft, { now: at, timeZone: OWNER_TIME_ZONE, hasConsent: contact.consent !== null });
  // Only quiet hours delay it; any other refusal means no acknowledgment at all.
  const sendAt = check.ok ? at : check.reason.startsWith("Quiet hours") ? nextAllowedHour(draft, at) : null;
  if (sendAt === null) return null;
  return store.addRuleOutbox(session, {
    businessId: business.id,
    cardId: null,
    channel: "telegram",
    to: contact.name,
    contactId: contact.id,
    body,
    sentAt: sendAt.toISOString(),
    delivery: "queued",
    note: null,
    rule: "acknowledge",
    ruleKey: acknowledgmentKey(contact.id, at),
  });
}

/** Fail every acknowledgment still queued for `businessId`, after the owner turned the rule off. Returns how many. */
export async function revokeAcknowledgments(store: Store, session: string, businessId: string): Promise<number> {
  const queued = (await store.listOutbox(session, businessId)).filter((entry) => entry.rule === "acknowledge" && entry.delivery === "queued");
  let revoked = 0;
  for (const entry of queued) {
    // Claiming first means a send already under way finishes, and this one can't be sent after it's failed.
    if ((await store.claimOutbox(session, entry.id)) === null) continue;
    await store.settleOutbox(session, entry.id, { delivery: "failed", note: "You turned off the acknowledgment rule, so this one wasn't sent." });
    revoked += 1;
  }
  return revoked;
}
