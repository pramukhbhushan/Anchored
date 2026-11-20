import "server-only";
import type { License } from "@/lib/domain/renewals";
import type { BusinessProfile } from "@/lib/domain/types";
import { runBusinessAgentWork } from "@/lib/server/agent-work";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Saves the owner's license dates for `/api/businesses/[id]/licenses`. The
// dates live on the profile, so profile history keeps each change, and saving
// runs the business's agent work at once, so a renewal already due becomes an
// owner reminder. Nothing here renews a license or messages anyone.

/** Save the owner's license dates on the profile, refresh the owner's reminders, and return the saved profile. */
export async function saveLicenses(session: string, business: BusinessProfile, licenses: readonly License[]): Promise<BusinessProfile> {
  const store = getStore();
  const saved = await store.saveBusiness(session, { ...business, details: { ...business.details, licenses } });
  await runBusinessAgentWork(store, session, saved);
  return saved;
}
