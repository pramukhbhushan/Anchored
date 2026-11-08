import "server-only";
import type { CustomerSummary, CustomersResponse, OutboxEntry, ThreadMessageView } from "@/lib/api/contract";
import type { Contact } from "@/lib/domain/contacts";
import type { ThreadMessage } from "@/lib/domain/threads";
import type { BusinessProfile } from "@/lib/domain/types";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// The Customer agent's conversations for the owner to read: each Telegram
// customer with their newest message, whether they stopped messages, and
// whether an allergy question of theirs waits for the owner, then one
// customer's thread with what happened to each message Anchored sent. Every
// read stays inside the owner's session. Nothing here sends or changes a thing.

// Bounds on one read, so a busy business can't make the page slow.
const MAX_CUSTOMERS = 100;
const SUMMARY_MESSAGES = 50;
const THREAD_MESSAGES = 200;

/** Return the business's Telegram customers and the thread of `selected`, or of the newest one when none is named. */
export async function customerThreads(session: string, business: BusinessProfile, selected: string | null): Promise<CustomersResponse> {
  if (business.kind === "case") {
    return { contacts: [], selectedContactId: null, messages: [], unavailableReason: "The shared example has no customer conversations. Create your own business and open its Telegram link to start one." };
  }
  const store = getStore();
  const [contacts, cards, outbox] = await Promise.all([store.listContacts(session, business.id), store.listCards(session, business.id), store.listOutbox(session, business.id)]);
  const lockedKeys = new Set(cards.filter((card) => card.channel === "locked" && card.status === "pending").map((card) => card.key));
  const customers = contacts.filter((contact) => contact.telegramChatId !== undefined).slice(0, MAX_CUSTOMERS);
  const recent = await Promise.all(customers.map((contact) => store.listThreadMessages(session, business.id, contact.id, SUMMARY_MESSAGES)));
  const summaries = customers
    .map((contact, i) => summary(contact, recent[i] ?? [], lockedKeys, cards.some((card) => card.channel === "locked" && card.status === "pending" && card.lockedContact === contact.id)))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  // Only a customer of this business can be selected; anything else is no selection, never another business's thread.
  const chosen = selected === null ? summaries[0] : summaries.find((customer) => customer.id === selected);
  if (chosen === undefined) return { contacts: summaries, selectedContactId: null, messages: [] };
  const thread = await store.listThreadMessages(session, business.id, chosen.id, THREAD_MESSAGES);
  const byId = new Map(outbox.map((entry) => [entry.id, entry]));
  return { contacts: summaries, selectedContactId: chosen.id, messages: thread.map((message) => view(message, message.outboxId === null ? undefined : byId.get(message.outboxId))) };
}

/** One customer's line in the list. */
function summary(contact: Contact, messages: readonly ThreadMessage[], lockedKeys: ReadonlySet<string>, locked = false): CustomerSummary {
  const last = messages.at(-1);
  return {
    id: contact.id,
    name: contact.name,
    ...(last === undefined ? {} : { lastText: last.text.slice(0, 140), lastAt: last.at }),
    stopped: contact.optedOutAt !== null,
    locked: locked || messages.some((message) => message.direction === "in" && message.cardKey !== null && lockedKeys.has(message.cardKey)),
  };
}

/** One message as the owner reads it, with its send's outcome when Anchored sent it. The provider's id stays here. */
function view(message: ThreadMessage, entry: OutboxEntry | undefined): ThreadMessageView {
  const delivery = entry?.delivery;
  return {
    id: message.id,
    direction: message.direction,
    text: message.text,
    at: message.at,
    ...(message.skill === null ? {} : { skill: message.skill }),
    ...(message.cardKey === null ? {} : { cardKey: message.cardKey }),
    ...(delivery === undefined || delivery === "yours" ? {} : { delivery }),
    ...(entry?.deletionNote ? { note: entry.deletionNote } : entry?.note ? { note: entry.note } : {}),
    ...(entry?.rule === undefined ? {} : { rule: entry.rule }),
  };
}
