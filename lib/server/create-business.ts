import "server-only";
import { profileFromAnswers } from "@/lib/domain/engine";
import type { BusinessProfile, OnboardingAnswers } from "@/lib/domain/types";
import { enrichProfile, isAiConfigured } from "@/lib/server/ai";

// =============================================================================
// Module Overview
// =============================================================================
// Builds a business from onboarding answers, for both the onboarding form's
// `POST /api/businesses` and the onboarding chat. The rules map the business;
// the configured AI provider, if any, only rewrites its text in the owner's words.

/** Build a profile from onboarding answers, with the AI provider's rewrite when one is set up. */
export async function buildProfileFromAnswers(answers: OnboardingAnswers): Promise<BusinessProfile> {
  const base = profileFromAnswers(answers);
  if (!isAiConfigured()) return base;
  try {
    return await enrichProfile(answers, base);
  } catch (error) {
    console.warn(`[Onboarding] AI enrichment failed; keeping the rules-built profile. Reason: ${error instanceof Error ? error.message : String(error)}`);
    return base;
  }
}
