import "server-only";
import type { StandingRulesResponse } from "@/lib/api/contract";
import { acknowledgmentText, ruleState } from "@/lib/domain/rules";
import type { BusinessProfile } from "@/lib/domain/types";
import { revokeAcknowledgments } from "@/lib/server/decide";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's standing rules, read and changed. There is one, `acknowledge`: a
// fixed "got your message" reply to every Telegram message, which starts on
// until the owner turns it off for this business. Turning it off fails every
// acknowledgment still queued. The shared example can't change.

/** Why the rule can't change for `business`, or `null` when the owner may change it. */
function lockedReason(business: BusinessProfile): string | null {
  return business.kind === "case" ? "This is the shared example, so its rules can't change. Create your own business to try it." : null;
}

/** Return the acknowledgment rule's saved state for `business`, with its exact text. */
export async function readStandingRules(session: string, business: BusinessProfile): Promise<StandingRulesResponse> {
  const saved = business.kind === "case" ? [] : await getStore().getStandingRules(session, business.id);
  const acknowledge = ruleState(saved, "acknowledge");
  return {
    acknowledge: { enabled: acknowledge.enabled, approvedAt: acknowledge.approvedAt },
    template: acknowledgmentText(business.name),
    unavailableReason: lockedReason(business),
  };
}

/** Raised when the owner may not change a rule on this business. */
export class RuleLockedError extends Error {
  override readonly name = "RuleLockedError";
}

/** Turn the acknowledgment rule on or off and return what was saved. Throws `RuleLockedError` on the shared example. */
export async function setAcknowledgment(session: string, business: BusinessProfile, enabled: boolean, now = new Date()): Promise<StandingRulesResponse> {
  const locked = lockedReason(business);
  if (locked !== null) throw new RuleLockedError(locked);
  const store = getStore();
  await store.setStandingRule(session, business.id, "acknowledge", enabled, now.toISOString());
  if (!enabled) await revokeAcknowledgments(store, session, business.id);
  return readStandingRules(session, business);
}
