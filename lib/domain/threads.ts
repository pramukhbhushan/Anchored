import type { SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// A customer's conversation with the business, one thread per contact. Every
// message in and out of their Telegram chat is a `ThreadMessage`, with the
// skill that wrote it and the card and outbox entry behind it, so any agent can
// see what was already said. The owner's own business chat with Anchored is a
// different thing and never mixes with these.

/** Which way a message went: from the customer, or to them. */
export type ThreadDirection = "in" | "out";

/** One message in a customer's thread. */
export interface ThreadMessage {
  readonly id: string;
  readonly businessId: string;
  readonly contactId: string;
  readonly direction: ThreadDirection;
  readonly text: string;
  /** The skill that drafted an outgoing message; `null` for the customer's own words and for fixed notices. */
  readonly skill: SkillId | null;
  /** The card an outgoing message was approved from, or the card an incoming one produced. */
  readonly cardKey: string | null;
  /** The outbox entry that sent an outgoing message. */
  readonly outboxId: string | null;
  /** The provider's id for the message, such as Telegram's message id. Kept server side. */
  readonly providerId: string | null;
  readonly at: string;
}

/** A thread message before the store assigns its id. */
export type NewThreadMessage = Omit<ThreadMessage, "id">;

/** How many of the latest thread messages a drafted reply may read. */
export const THREAD_CONTEXT_LIMIT = 10;

/** The longest message text a thread keeps. Telegram's own limit is 4,096 characters. */
export const THREAD_TEXT_MAX = 4096;

/** Return `messages` oldest first, with ties kept in the order given. */
export function inOrder(messages: readonly ThreadMessage[]): ThreadMessage[] {
  return messages.map((message, index) => ({ message, index })).sort((a, b) => a.message.at.localeCompare(b.message.at) || a.index - b.index).map(({ message }) => message);
}
