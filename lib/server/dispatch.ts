import "server-only";
import { customerLocked, followupStillAllowed } from "@/lib/server/agent-work";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import { ConnectorError, type FetchLike } from "@/lib/connectors/errors";
import { emailAccountFromEnv, sendEmail } from "@/lib/connectors/email";
import { deleteTelegramMessage, sendTelegramMessage, TelegramBlockedError, telegramBotFromEnv } from "@/lib/connectors/telegram";
import { sendTwilioText } from "@/lib/connectors/twilio";
import { deliveryFor, type Delivery, type PlannedMessage, type SendingSetup } from "@/lib/domain/contacts";
import { checkProtocolNotice, checkSend, OWNER_TIME_ZONE, sendTimeText } from "@/lib/domain/executor";
import { ruleEnabled } from "@/lib/domain/rules";
import type { CardDraft } from "@/lib/domain/types";
import { getStore } from "@/lib/store";
import type { Store, StoredConnection } from "@/lib/store/types";
import { canStoreSecrets, decryptSecret } from "@/lib/server/secrets";

// =============================================================================
// Module Overview
// =============================================================================
// The one place Anchored sends. `planDelivery` decides, when the owner
// approves, whether Anchored sends a message itself or leaves it to the owner.
// `dispatchEntry` sends one queued outbox entry: it claims the entry so no
// other sender takes it, runs `checkSend` again, since quiet hours or a STOP
// may have arrived since approval, then sends through the connected service
// and records what happened. `dispatchDue` runs every due entry for the cron.
// A Telegram message also checks that the customer's chat still talks to this
// business and hasn't blocked the bot, and joins the customer's thread once sent.

const HOUR_MS = 60 * 60 * 1000;

/** What a business has connected for sending, read from its connections and the server's settings. */
function sendingSetup(connections: readonly StoredConnection[], env: Readonly<Record<string, string | undefined>>): SendingSetup {
  const texting = connections.some((connection) => connection.kind === "texting" && connection.secret !== null) && canStoreSecrets(env);
  const email = connections.some((connection) => connection.kind === "email-out") && emailAccountFromEnv(env) !== null;
  return { texting, email, telegram: telegramBotFromEnv(env) !== null };
}

/** Decide who sends an approved message for a business: Anchored, through a connected service, or the owner. */
export async function planDelivery(
  store: Store,
  session: string,
  businessId: string,
  message: PlannedMessage,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Delivery> {
  const [connections, contacts] = await Promise.all([store.listConnections(session, businessId), store.listContacts(session, businessId)]);
  return deliveryFor(message, sendingSetup(connections, env), contacts);
}

/** What one dispatch did with an entry. */
type DispatchOutcome = "sent" | "failed" | "yours" | "requeued" | "skipped";

/** Read the texting connection's auth token. */
function twilioToken(connection: StoredConnection, env: Readonly<Record<string, string | undefined>>): string {
  const parsed = JSON.parse(decryptSecret(connection.secret ?? "", env)) as { authToken?: unknown };
  if (typeof parsed.authToken !== "string") throw new Error("The stored Twilio credentials are incomplete. Reconnect texting.");
  return parsed.authToken;
}

/** Send one queued entry, if it is still queued, and record the result. */
export async function dispatchEntry(
  store: Store,
  session: string,
  entryId: string,
  now: Date,
  deps: { readonly fetch?: FetchLike; readonly env?: Readonly<Record<string, string | undefined>> } = {},
): Promise<DispatchOutcome> {
  const env = deps.env ?? process.env;
  const entry = await store.claimOutbox(session, entryId);
  if (entry === null) return "skipped";
  const settle = (delivery: OutboxEntry["delivery"], note: string | null, extra: { providerId?: string; sentAt?: string } = {}) =>
    store.settleOutbox(session, entry.id, { delivery, note, ...extra });
  try {
    const [card, business, connections, contacts] = await Promise.all([
      entry.cardId === null ? Promise.resolve(null) : store.getCard(session, entry.cardId),
      store.getBusiness(session, entry.businessId),
      store.listConnections(session, entry.businessId),
      store.listContacts(session, entry.businessId),
    ]);
    if (entry.channel === "telegram" && entry.rule !== "protocol" && entry.contactId !== undefined && await customerLocked(store, session, entry.businessId, entry.contactId)) {
      await settle("failed", "This customer has an allergy question waiting. Handle it yourself before sending another reply.");
      return "failed";
    }
    if (card !== null && business !== null && !(await followupStillAllowed(store, session, business, card, now))) {
      await settle("failed", "This follow-up was canceled or its recorded facts changed, so it wasn't sent.");
      return "failed";
    }
    // An entry a rule authorized has no card; any other entry without one lost it to a deletion.
    if (business === null || (card === null && entry.rule === undefined)) {
      await settle("failed", "The card or business behind this message was deleted, so it wasn't sent.");
      return "failed";
    }
    // An acknowledgment goes out only while the owner's rule is still on, whenever it was queued.
    if (entry.rule === "acknowledge" && !ruleEnabled(await store.getStandingRules(session, entry.businessId), "acknowledge")) {
      await settle("failed", "You turned off the acknowledgment rule, so this one wasn't sent.");
      return "failed";
    }
    const draft: CardDraft = { ...(card ?? RULE_DRAFT), body: entry.body, channel: entry.channel };
    // The rules again, on the words that will actually go out: quiet hours or a new STOP may apply now.
    const check = entry.rule === "protocol" ? checkProtocolNotice(entry.body) : checkSend(draft, { now, timeZone: OWNER_TIME_ZONE, hasConsent: true });
    if (!check.ok) {
      if (check.reason.startsWith("Quiet hours")) {
        await settle("queued", null, { sentAt: nextDaytimeHour(draft, entry.body, now).toISOString() });
        return "requeued";
      }
      await settle("failed", check.reason);
      return "failed";
    }
    const delivery = deliveryFor(entry, sendingSetup(connections, env), contacts);
    if (delivery.by === "owner") {
      // Nobody but Anchored can write into a customer's chat with the shared bot, so a Telegram refusal is a failure.
      const outcome = entry.channel === "telegram" ? "failed" : "yours";
      await settle(outcome, delivery.reason);
      return outcome;
    }
    if (entry.channel === "telegram") return await sendTelegram(store, session, entry, card, delivery.to, now, env, deps.fetch ?? fetch);
    const id = await send(entry, delivery.to, business.name, connections, env, deps.fetch ?? fetch);
    await settle("sent", null, { providerId: id, sentAt: now.toISOString() });
    return "sent";
  } catch (error) {
    // A provider's refusal is written for the owner; anything else gets a plain fallback and a log line.
    if (!(error instanceof ConnectorError)) console.error(`[Dispatch] Sending outbox entry ${entry.id} failed.`, error);
    await settle("failed", error instanceof ConnectorError ? error.message : "Sending was not confirmed. It may have sent. Check the conversation before trying again.");
    return "failed";
  }
}

// What `checkSend` reads for an entry a rule authorized: its words and channel, with nothing a card would add.
const RULE_DRAFT: CardDraft = { agent: null, skill: null, title: "", body: "", reason: "", checks: [], action: "", channel: "telegram" };

// A Telegram send that didn't reach Telegram is tried once more after this long.
const TELEGRAM_RETRY_MS = 5 * 60 * 1000;

/** Send one Telegram entry to `chatId`, after checking the chat still talks to this business, and add it to the thread. */
async function sendTelegram(
  store: Store,
  session: string,
  entry: OutboxEntry,
  card: CardRecord | null,
  chatId: string,
  now: Date,
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: FetchLike,
): Promise<DispatchOutcome> {
  const settle = (delivery: OutboxEntry["delivery"], note: string | null, extra: { providerId?: string; sentAt?: string } = {}) =>
    store.settleOutbox(session, entry.id, { delivery, note, ...extra });
  const bot = telegramBotFromEnv(env);
  if (bot === null || entry.contactId === undefined) {
    await settle("failed", "Telegram isn't set up on this server, so Anchored can't send this message.");
    return "failed";
  }
  // The customer may have opened another business's link since approval; the newest one is who they're talking to.
  const chat = await store.findTelegramChat(chatId);
  if (chat === null || chat.session !== session || chat.businessId !== entry.businessId) {
    await settle("failed", "This customer switched to another business's link, so this message wasn't sent.");
    return "failed";
  }
  if (chat.blockedAt !== null) {
    await settle("failed", "This customer blocked the bot on Telegram, so Anchored can't message them.");
    return "failed";
  }
  let id: string;
  try {
    id = (await sendTelegramMessage(bot, chatId, entry.body, [], fetchImpl)).id;
  } catch (error) {
    if (error instanceof TelegramBlockedError) await store.setTelegramChatBlocked(chatId, now.toISOString());
    // One more try for a send that never reached Telegram; a second miss is the owner's to see.
    if (error instanceof ConnectorError && error.retryable && entry.note === null) {
      const later = new Date(now.getTime() + TELEGRAM_RETRY_MS);
      await settle("queued", `Telegram didn't answer. Anchored tries once more at ${sendTimeText(later)}.`, { sentAt: later.toISOString() });
      return "requeued";
    }
    throw error;
  }
  await settle("sent", null, { providerId: id, sentAt: now.toISOString() });
  try {
    await store.addThreadMessage(session, {
      businessId: entry.businessId,
      contactId: entry.contactId,
      direction: "out",
      text: entry.body,
      skill: card?.skill ?? null,
      cardKey: card?.key ?? null,
      outboxId: entry.id,
      providerId: id,
      at: now.toISOString(),
    });
  } catch (error) {
    // The message went out; a missing thread line must not turn a real send into a reported failure.
    console.error(`[Dispatch] Sent outbox entry ${entry.id}, but couldn't add it to the customer's thread.`, error);
  }
  return "sent";
}

/** Send through the connected service for the entry's channel. Returns the provider's message id. */
async function send(
  entry: OutboxEntry,
  to: string,
  businessName: string,
  connections: readonly StoredConnection[],
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: FetchLike,
): Promise<string> {
  if (entry.channel === "sms") {
    const texting = connections.find((connection) => connection.kind === "texting");
    const from = texting?.settings.phone;
    const accountSid = texting?.settings.accountSid;
    if (texting === undefined || from === undefined || accountSid === undefined) throw new ConnectorError("Texting isn't connected anymore. Reconnect it, or send this one yourself.", false);
    return (await sendTwilioText({ accountSid, authToken: twilioToken(texting, env), from }, to, entry.body, fetchImpl)).id;
  }
  const account = emailAccountFromEnv(env);
  const replyTo = connections.find((connection) => connection.kind === "email-out")?.settings.replyTo;
  if (account === null || replyTo === undefined) throw new ConnectorError("Email sending isn't connected anymore. Send this one yourself.", false);
  return (await sendEmail(account, { to, replyTo, fromName: businessName, subject: `A note from ${businessName}`, text: entry.body }, fetchImpl)).id;
}

/** The first whole hour after `now` when quiet hours allow the text. */
function nextDaytimeHour(card: CardDraft, body: string, now: Date): Date {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let hours = 1; hours <= 24; hours += 1) {
    const candidate = new Date(start.getTime() + hours * HOUR_MS);
    if (checkSend({ ...card, body }, { now: candidate, timeZone: OWNER_TIME_ZONE, hasConsent: true }).ok) return candidate;
  }
  return new Date(now.getTime() + 12 * HOUR_MS);
}

/** Send every queued entry due by `now`, across all sessions, and count the outcomes. */
export async function dispatchDue(now: Date, limit = 50, deps: Parameters<typeof dispatchEntry>[4] = {}, store: Store = getStore()): Promise<Record<DispatchOutcome, number>> {
  const counts: Record<DispatchOutcome, number> = { sent: 0, failed: 0, yours: 0, requeued: 0, skipped: 0 };
  for (const { session, entry } of await store.listDueOutbox(now.toISOString(), limit)) {
    counts[await dispatchEntry(store, session, entry.id, now, deps)] += 1;
  }
  return counts;
}

/** Whether Telegram can still remove this stored message. The provider checks its own limits too. */
export function canDeleteTelegram(entry: OutboxEntry, now: Date, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const age = now.getTime() - Date.parse(entry.sentAt);
  return entry.channel === "telegram" && entry.delivery === "sent" && entry.deletionState !== "deleted" && entry.deletionState !== "deleting"
    && /^[1-9][0-9]*$/.test(entry.providerId ?? "") && age >= 0 && age < 48 * HOUR_MS && telegramBotFromEnv(env) !== null;
}

/** Remove an owned, previously sent Telegram message, retaining its original text and send audit. */
export async function deleteDispatchedTelegram(session: string, businessId: string, entryId: string, now = new Date(), deps: Parameters<typeof dispatchEntry>[4] = {}, store: Store = getStore()): Promise<{ status: number; deleted: boolean; message: string }> {
  const entry = (await store.listOutbox(session, businessId)).find((item) => item.id === entryId);
  if (entry === undefined) return { status: 404, deleted: false, message: "Message not found in this business." };
  if (entry.deletionState === "deleted") return { status: 200, deleted: true, message: "Removed from Telegram. Someone may already have read it." };
  const env = deps.env ?? process.env;
  if (!canDeleteTelegram(entry, now, env)) return { status: 409, deleted: false, message: entry.deletionState === "deleting" ? "Removal is still being checked. Refresh before trying again." : "This message cannot be removed. Telegram allows removal for 48 hours after sending, while the bot is connected." };
  const contact = (await store.listContacts(session, businessId)).find((item) => item.id === entry.contactId);
  if (contact?.telegramChatId === undefined) return { status: 409, deleted: false, message: "The original Telegram chat is no longer available." };
  if (await store.claimTelegramDeletion(session, businessId, entry.id) === null) return { status: 409, deleted: false, message: "Another removal request already took this message. Refresh to see its result." };
  try {
    await deleteTelegramMessage(telegramBotFromEnv(env)!, contact.telegramChatId, entry.providerId!, deps.fetch);
  } catch (error) {
    // Telegram reports an already absent message this way. Removal is idempotent, but never claims it was unread.
    if (!(error instanceof ConnectorError && /message to delete not found/i.test(error.message))) {
      const message = error instanceof ConnectorError ? error.message : "Telegram did not confirm removal. Refresh, then try again.";
      await store.settleOutbox(session, entry.id, { delivery: "sent", deletionState: "failed", deletionNote: message });
      return { status: 502, deleted: false, message };
    }
  }
  await store.settleOutbox(session, entry.id, { delivery: "sent", deletionState: "deleted", deletionNote: "Removed from Telegram. Someone may already have read it." });
  return { status: 200, deleted: true, message: "Removed from Telegram. Someone may already have read it." };
}
