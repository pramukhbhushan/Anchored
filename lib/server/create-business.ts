import "server-only";
import type { BusinessProfile } from "@/lib/domain/types";
import { seedDemoBusiness } from "@/lib/server/demo-seed";
import { scheduleStarters } from "@/lib/server/starters";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Saves a new business for both the onboarding form's `POST /api/businesses`
// and the onboarding chat, with the raw onboarding input. The rules build the
// profile before this runs: no business exists yet, so no owner AI key does.

/** Save a new business with its raw onboarding input, seed an example copy's demo data, and start writing its starter drafts. */
export async function saveNewBusiness(session: string, business: BusinessProfile, raw: Readonly<Record<string, unknown>>, options: { readonly seedExample: boolean }): Promise<void> {
  const store = getStore();
  await store.saveBusiness(session, business, "onboarding");
  await store.recordEvent(session, business.id, "onboarding_raw", raw);
  if (options.seedExample) await seedDemoBusiness(store, session, business);
  // The starters are written after the response, so the owner reaches the plan without waiting on the model.
  scheduleStarters(session, business);
}
