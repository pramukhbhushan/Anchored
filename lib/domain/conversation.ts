import type { ConversationOwner } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The allowed ownership changes for one customer conversation. Routing code
// asks this table before it hands work to another agent, so an unknown or
// backward jump is rejected by code rather than invented by a model.

/** Conversation owners each state may hand work to. */
const ALLOWED_HANDOFFS: Readonly<Record<ConversationOwner, readonly ConversationOwner[]>> = {
  frontdesk: ["followup", "books", "closed"],
  followup: ["frontdesk", "books", "closed"],
  books: ["frontdesk", "closed"],
  closed: [],
};

/** Whether an agent id can own a customer conversation. */
export function isConversationOwner(value: string): value is ConversationOwner {
  return Object.hasOwn(ALLOWED_HANDOFFS, value);
}

/** Whether a conversation may move from `from` to `to`. Staying put is always valid. */
export function canHandoff(from: ConversationOwner, to: ConversationOwner): boolean {
  return from === to || ALLOWED_HANDOFFS[from].includes(to);
}

/** Return the new owner, or a plain rejection for an illegal transition. */
export function handoffConversation(from: ConversationOwner, to: ConversationOwner): { readonly ok: true; readonly owner: ConversationOwner } | { readonly ok: false; readonly reason: string } {
  return canHandoff(from, to)
    ? { ok: true, owner: to }
    : { ok: false, reason: `A ${from} conversation cannot move to ${to}.` };
}
