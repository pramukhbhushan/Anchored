import { usesSoftware } from "@/lib/domain/rating";
import { askExample, takesRequests } from "@/lib/domain/requests";
import type { BusinessProfile, SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The starter messages a fresh business chat offers. `chatStarters` keeps only
// the ones that would be news for this business, so a restaurant that already
// caters is never offered "We started doing catering", and leads with a request
// one of the owner's agents drafts. `GENERIC_STARTERS` is what the chat shows
// when the page passes none.

/** Starters true of no business in particular, for a chat that wasn't given its own. */
export const GENERIC_STARTERS: readonly string[] = [
  "We added a new service",
  "We started using a new tool",
  "Customers can reach us a new way",
];

/** A starter and the test that says it would be news for a business. */
interface Candidate {
  readonly text: string;
  readonly isNews: (business: BusinessProfile) => boolean;
}

// The order is the order they show in; the ones that fit any trade come first.
const CANDIDATES: readonly Candidate[] = [
  { text: "We started taking appointments", isNews: (b) => !b.signals.includes("appointments") },
  { text: "We switched to Square", isNews: (b) => !usesSoftware(b, "Square") },
  { text: "We hired our first staff", isNews: (b) => !b.signals.includes("shifts") },
  { text: "We started doing catering", isNews: (b) => !b.signals.includes("catering") },
  { text: "We now sell maintenance plans", isNews: (b) => !b.signals.includes("memberships") },
  { text: "We now take EBT", isNews: (b) => !b.signals.includes("snap") },
];

const SHOWN = 3;

/** Return up to three starters: a request one of the `chosen` skills drafts, then news for `business`, topped up with generic ones. */
export function chatStarters(business: BusinessProfile, chosen: readonly SkillId[] = []): string[] {
  const ask = takesRequests(chosen) ? [askExample(chosen)] : [];
  const fitting = CANDIDATES.filter((c) => c.isNews(business)).map((c) => c.text);
  return [...ask, ...fitting, ...GENERIC_STARTERS].slice(0, SHOWN);
}
