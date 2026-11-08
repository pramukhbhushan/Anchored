// =============================================================================
// Module Overview
// =============================================================================
// Where a card came from, read from its key. `eventCardKey` names a card a
// real outside event drafted, such as a missed call on the owner's Twilio
// number; `isOwnersOwn` tells those, and the work an owner asked for in chat,
// apart from sample drafts, whose names, times and dollars are made up.

/** Return the key of a card a real outside event drafted, such as a webhook from Twilio, Stripe or forwarded email. */
export function eventCardKey(businessId: string, eventId: string): string {
  return `${businessId}:event:${eventId}`;
}

/** Whether a card came from the owner's own data: a real event, or work they asked for in chat. */
export function isOwnersOwn(key: string): boolean {
  // `chatCardKey` in `requests.ts` writes ":chat:"; `eventCardKey` writes ":event:".
  return key.includes(":event:") || key.includes(":chat:");
}
