// =============================================================================
// Module Overview
// =============================================================================
// The few messages Anchored may send without a tap on each one. A standing rule
// is one the owner can turn off; v1 has only `acknowledge`, a fixed "got your
// message" reply that starts on, since customers expect to hear that their
// message landed. A protocol notice is the bot's
// fixed answer to a customer's own /start or /stop. Both are fixed text, never
// written by the model, and both still pass `checkSend` before they go out.

/** A standing rule the owner can turn on. */
export type StandingRuleId = "acknowledge";

/** What authorized an outbox entry that no card tap approved: an owner's standing rule, or a protocol notice. */
export type OutboxRule = StandingRuleId | "protocol";

/** A standing rule's saved state for one business. */
export interface StandingRuleState {
  readonly rule: StandingRuleId;
  readonly enabled: boolean;
  /** When the owner last turned it on, or `null` if they never have. */
  readonly approvedAt: string | null;
  readonly changedAt: string;
}

/** A rule as it stands before the owner has ever changed it: on. */
export function defaultRuleState(rule: StandingRuleId): StandingRuleState {
  return { rule, enabled: true, approvedAt: null, changedAt: new Date(0).toISOString() };
}

/** Return `rule`'s state from a business's saved states, or its default when the owner never changed it. */
export function ruleState(states: readonly StandingRuleState[], rule: StandingRuleId): StandingRuleState {
  return states.find((state) => state.rule === rule) ?? defaultRuleState(rule);
}

/** Whether `rule` is on, given a business's saved states. A rule with no saved state takes its default. */
export function ruleEnabled(states: readonly StandingRuleState[], rule: StandingRuleId): boolean {
  return ruleState(states, rule).enabled;
}

// =============================================================================
// Fixed texts
// =============================================================================

/** The acknowledgment the `acknowledge` rule sends, exactly as the owner approves it. */
export function acknowledgmentText(businessName: string): string {
  return `Thanks, ${businessName} got your message and will reply soon.`;
}

/** How long one acknowledgment covers a customer: later messages in the window get none. */
const ACKNOWLEDGMENT_WINDOW_HOURS = 12;

/** The key that allows one acknowledgment per contact per window, so a retry or a burst of messages sends one. */
export function acknowledgmentKey(contactId: string, at: Date): string {
  const windowMs = ACKNOWLEDGMENT_WINDOW_HOURS * 60 * 60 * 1000;
  const start = Math.floor(at.getTime() / windowMs) * windowMs;
  return `ack:${contactId}:${new Date(start).toISOString()}`;
}

/** The bot's answer to /start: which business the customer is now talking to. */
export function startNoticeText(businessName: string): string {
  return `You're now messaging ${businessName}. Send your question here and they'll reply.`;
}

/** The bot's answer to /stop. */
export function stopNoticeText(businessName: string): string {
  return `You won't get more messages from ${businessName}. To message them again, open their link.`;
}
