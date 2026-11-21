import "server-only";
import { profileFromAnswers } from "@/lib/domain/engine";
import type { BusinessProfile, OnboardingAnswers } from "@/lib/domain/types";
import { enrichProfile, isAiConfigured } from "@/lib/server/ai";
import { seedDemoBusiness } from "@/lib/server/demo-seed";
import { scheduleStarters } from "@/lib/server/starters";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Builds a business from onboarding answers, for both the onboarding form's
// `POST /api/businesses` and the onboarding chat. The rules map the business;
// the configured AI provider, if any, only rewrites its text in the owner's words.
// `saveNewBusiness` saves the result for both, with the raw onboarding input.

/** Build a profile from onboarding answers, with the AI provider's rewrite when one is set up. */
export async function buildProfileFromAnswers(answers: OnboardingAnswers): Promise<BusinessProfile> {
  const base = profileFromAnswers(answers);
  // The business doesn't exist yet, so only the server's key can rewrite it.
  if (!(await isAiConfigured(null))) return base;
  try {
    return await enrichProfile(answers, base);
  } catch (error) {
    console.warn(`[Onboarding] AI enrichment failed; keeping the rules-built profile. Reason: ${error instanceof Error ? error.message : String(error)}`);
    return base;
  }
}

/** Save a new business with its raw onboarding input, seed an example copy's demo data, and start writing its starter drafts. */
export async function saveNewBusiness(session: string, business: BusinessProfile, raw: Readonly<Record<string, unknown>>, options: { readonly seedExample: boolean }): Promise<void> {
  const store = getStore();
  await store.saveBusiness(session, business, "onboarding");
  await store.recordEvent(session, business.id, "onboarding_raw", raw);
  if (options.seedExample) await seedDemoBusiness(store, session, business);
  // The starters are written after the response, so the owner reaches the plan without waiting on the model.
  scheduleStarters(session, business);
}
