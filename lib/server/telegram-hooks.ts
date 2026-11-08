import "server-only";
import type { TelegramUpdate } from "@/lib/connectors/telegram";
import type { FetchLike } from "@/lib/connectors/errors";
import { contactByTelegramChat, type Contact } from "@/lib/domain/contacts";
import { liveEventKey } from "@/lib/domain/cards";
import { startNoticeText, stopNoticeText } from "@/lib/domain/rules";
import { THREAD_TEXT_MAX } from "@/lib/domain/threads";
import { draftTelegramCard, TELEGRAM_CUSTOMER } from "@/lib/server/customer-reply";
import { mentionsAllergen } from "@/lib/domain/executor";
import { queueAcknowledgment, queueProtocolNotice } from "@/lib/server/decide";
import { dispatchEntry } from "@/lib/server/dispatch";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { getStore } from "@/lib/store";
import type { TelegramChat } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// What the shared Telegram bot does with one verified update. `/start <hook>`
// opens a business's link: the chat is bound to that business, the customer is
// saved with "messaged first" as their OK, and the bot confirms who they're
// talking to. `/stop`, or blocking the bot, records the opt-out before anything
// else. Any other text joins the customer's thread and becomes a draft reply
// for the owner. The webhook never sends by itself: the only messages that go
// out here are fixed texts, the /start and /stop notices and, when the owner
// turned the rule on, the acknowledgment, each written to the outbox by
// `lib/server/decide.ts` and sent by the one dispatcher.

/** What one update did, for the route's answer and the logs. Never includes customer text. */
export type TelegramOutcome = "started" | "stopped" | "blocked" | "unblocked" | "drafted" | "limited" | "unbound" | "ignored";

/** What sending needs, passed through to the dispatcher so tests can hand it a fake `fetch`. */
export interface TelegramDeps {
  readonly fetch?: FetchLike;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

// Per instance, like the middleware's limits: enough to stop one chat or one flood from spending the model budget.
const limiter = createRateLimiter();
const PER_CHAT = { limit: 20, windowMs: 10 * 60 * 1000 };
const PER_BUSINESS = { limit: 200, windowMs: 10 * 60 * 1000 };

/** Handle one update the route has verified and claimed. Throws when a write fails, so Telegram retries the update. */
export async function handleTelegramUpdate(update: TelegramUpdate, now: Date, deps: TelegramDeps = {}): Promise<TelegramOutcome> {
  switch (update.kind) {
    case "start":
      return update.hookId === null ? "unbound" : start(update.chatId, update.name, update.hookId, now, deps);
    case "stop":
      return stop(update.chatId, now, deps);
    case "blocked":
      return blocked(update.chatId, now);
    case "unblocked":
      // Unblocking alone restores nothing: the customer opens a business's link again to start over.
      await getStore().setTelegramChatBlocked(update.chatId, null);
      return "unblocked";
    case "text":
      return text(update.chatId, update.name, update.text, update.updateId, now, deps);
    case "ignored":
      return "ignored";
  }
}

/** Bind the chat to the business `hookId` names, save the customer with their OK, and confirm who they're talking to. */
async function start(chatId: string, name: string | null, hookId: string, now: Date, deps: TelegramDeps): Promise<TelegramOutcome> {
  const store = getStore();
  const found = await store.findTelegramHook(hookId);
  if (found === null) return "unbound";
  const { session, businessId } = found;
  const business = await store.getBusiness(session, businessId);
  if (business === null) return "unbound";
  const at = now.toISOString();
  const known = contactByTelegramChat(await store.listContacts(session, businessId), chatId);
  // Opening the link again is the customer's own restart, so it clears an earlier /stop for this business.
  const contact = await store.saveContact(session, {
    ...(known === undefined ? {} : { id: known.id }),
    businessId,
    name: known?.name ?? name ?? TELEGRAM_CUSTOMER,
    phone: known?.phone ?? null,
    email: known?.email ?? null,
    consent: { source: "messaged-first", at },
    optedOutAt: null,
    telegramChatId: chatId,
    ...(name === null ? (known?.telegramName === undefined ? {} : { telegramName: known.telegramName }) : { telegramName: name }),
  });
  await store.bindTelegramChat(session, { chatId, businessId, contactId: contact.id, boundAt: at });
  await notify(session, businessId, contact, startNoticeText(business.name), now, deps);
  return "started";
}

/** Record the customer's /stop for the business their chat talks to, then confirm it. */
async function stop(chatId: string, now: Date, deps: TelegramDeps): Promise<TelegramOutcome> {
  const store = getStore();
  const chat = await store.findTelegramChat(chatId);
  if (chat === null) return "unbound";
  const contact = await optOut(chat, now);
  const business = await store.getBusiness(chat.session, chat.businessId);
  if (contact !== null && business !== null) await notify(chat.session, chat.businessId, contact, stopNoticeText(business.name), now, deps);
  return "stopped";
}

/** Record that the customer blocked the bot: no business may message them, and their bound business has their STOP. */
async function blocked(chatId: string, now: Date): Promise<TelegramOutcome> {
  const store = getStore();
  await store.setTelegramChatBlocked(chatId, now.toISOString());
  const chat = await store.findTelegramChat(chatId);
  if (chat !== null) await optOut(chat, now);
  return "blocked";
}

/** Mark the chat's contact as opted out, and return them; `null` when the contact is gone. */
async function optOut(chat: TelegramChat, now: Date): Promise<Contact | null> {
  const store = getStore();
  const contact = (await store.listContacts(chat.session, chat.businessId)).find((candidate) => candidate.id === chat.contactId);
  if (contact === undefined) return null;
  // An earlier opt-out keeps its date, so a repeated /stop doesn't move it.
  return store.saveContact(chat.session, { ...contact, optedOutAt: contact.optedOutAt ?? now.toISOString() });
}

/** Queue a fixed notice for the customer and send it now through the dispatcher. */
async function notify(session: string, businessId: string, contact: Contact, body: string, now: Date, deps: TelegramDeps): Promise<void> {
  const store = getStore();
  const entry = await queueProtocolNotice(store, session, { businessId, contact, body, at: now });
  if (entry !== null) await dispatchEntry(store, session, entry.id, now, deps);
}

/**
 * Add the customer's message to their thread, draft the reply card for the owner, and send the fixed acknowledgment
 * when the owner turned that rule on. An allergy question or a customer who sent /stop gets no acknowledgment.
 */
async function text(chatId: string, name: string | null, body: string, updateId: number, now: Date, deps: TelegramDeps): Promise<TelegramOutcome> {
  const store = getStore();
  const chat = await store.findTelegramChat(chatId);
  // A chat that never opened a business's link has no business to write to, and the webhook may not reply on its own.
  if (chat === null) return "unbound";
  if (chat.blockedAt !== null) await store.setTelegramChatBlocked(chatId, null);
  const nowMs = now.getTime();
  if (!limiter.check(`tg-chat:${chatId}`, PER_CHAT, nowMs).allowed || !limiter.check(`tg-business:${chat.businessId}`, PER_BUSINESS, nowMs).allowed) {
    console.warn(`[Telegram] Rate limit reached for a chat of business ${chat.businessId}; no draft made.`);
    return "limited";
  }
  const business = await store.getBusiness(chat.session, chat.businessId);
  if (business === null) return "unbound";
  const contacts = await store.listContacts(chat.session, chat.businessId);
  const contact = contacts.find((candidate) => candidate.id === chat.contactId);
  if (contact === undefined) return "unbound";
  // A customer who now shows a name gets it on record, in place of the placeholder.
  if (name !== null && contact.name === TELEGRAM_CUSTOMER) await store.saveContact(chat.session, { ...contact, name, telegramName: name });

  // The update id fixes the card's key, so a retried update finds its message and card already there.
  const key = liveEventKey(business.id, `tg-${updateId}`);
  const recent = await store.listThreadMessages(chat.session, business.id, contact.id, 50);
  if (!recent.some((message) => message.direction === "in" && message.cardKey === key)) {
    await store.recordEvent(chat.session, business.id, "telegram", { contactId: contact.id, key });
    await store.addThreadMessage(chat.session, {
      businessId: business.id,
      contactId: contact.id,
      direction: "in",
      text: body.slice(0, THREAD_TEXT_MAX),
      skill: null,
      cardKey: key,
      outboxId: null,
      providerId: null,
      at: now.toISOString(),
    });
  }
  if ((await draftTelegramCard(chat.session, business, { contactId: contact.id, text: body, key })) === null) return "ignored";
  if (!mentionsAllergen(body) && contact.optedOutAt === null) {
    const ack = await queueAcknowledgment(store, chat.session, { business, contact, at: now });
    if (ack !== null) await dispatchEntry(store, chat.session, ack.id, now, deps);
  }
  return "drafted";
}
