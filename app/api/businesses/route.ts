import { randomUUID } from "node:crypto";
import type { CreateBusinessResponse, DeleteBusinessesResponse } from "@/lib/api/contract";
import { createBusinessSchema } from "@/lib/api/schemas";
import { EXAMPLES, exampleProfile } from "@/lib/domain/cases";
import { withCrewDecisions } from "@/lib/domain/crew";
import { mergeCandidates } from "@/lib/domain/details";
import { profileFromSentence } from "@/lib/domain/engine";
import type { BusinessProfile } from "@/lib/domain/types";
import { buildProfileFromAnswers } from "@/lib/server/create-business";
import { seedDemoBusiness } from "@/lib/server/demo-seed";
import { extractDetails } from "@/lib/server/extract";
import { fetchPage } from "@/lib/server/fetch-page";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { placeDetails } from "@/lib/server/places";
import { getSessionId } from "@/lib/server/session";
import { scheduleStarters } from "@/lib/server/starters";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/businesses builds a business from onboarding answers, an example
// or one sentence, and saves it to the visitor's session. The rules engine maps
// it; the configured AI provider, if any, only rewrites the text in the owner's words.
// DELETE removes everything the visitor saved: their businesses and every choice,
// card and outbox message, including what they changed on the example business.

/** Build the profile for a validated request, or return `null` for an unknown example. */
async function buildProfile(request: ReturnType<typeof createBusinessSchema.parse>): Promise<BusinessProfile | null> {
  if (request.from === "example") {
    if (!EXAMPLES.some((example) => example.id === request.exampleId)) return null;
    // Each visitor gets their own copy, so their choices never touch the shared example.
    return { ...exampleProfile(request.exampleId), id: `b_${randomUUID()}`, kind: "custom" };
  }
  if (request.from === "sentence") return profileFromSentence(request.sentence);
  return buildProfileFromAnswers(request.answers);
}

/** Create a business for this session. */
export async function POST(request: Request) {
  const parsed = await readBody(request, createBusinessSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const built = await buildProfile(parsed.data);
    if (!built) return fail(400, "That example doesn't exist. Pick one from the list.");
    let business = withCrewDecisions(built);
    let placeRaw: { readonly listingText?: string; readonly website?: { readonly url: string; readonly title: string; readonly text: string } } | undefined;
    let sourceWebsite = parsed.data.from === "answers" ? parsed.data.answers.website : undefined;
    if (parsed.data.from === "answers" && parsed.data.placeId !== undefined) {
      business = { ...business, placeId: parsed.data.placeId };
      const facts = await placeDetails(parsed.data.placeId);
      if (facts !== null) {
        const [listingCandidates, reviewCandidates] = await Promise.all([
          extractDetails("listing", facts.listingText ?? ""),
          extractDetails("reviews", facts.reviewText ?? ""),
        ]);
        const merged = mergeCandidates(
          { details: business.details ?? {}, evidence: business.evidence ?? {} },
          [...facts.candidates, ...listingCandidates, ...reviewCandidates],
        );
        business = { ...business, details: merged.details, evidence: merged.evidence };
        placeRaw = !facts.listingText ? undefined : { listingText: facts.listingText };
        sourceWebsite = facts.website ?? sourceWebsite;
      }
    }
    if (sourceWebsite !== undefined) {
      const page = await fetchPage(sourceWebsite);
      if (page !== null) {
        const merged = mergeCandidates(
          { details: business.details ?? {}, evidence: business.evidence ?? {} },
          await extractDetails("website", page.text),
        );
        business = { ...business, details: merged.details, evidence: merged.evidence };
        placeRaw = { ...placeRaw, website: { url: page.url, title: page.title, text: page.text } };
      }
    }
    const session = await getSessionId();
    const store = getStore();
    await store.saveBusiness(session, business, "onboarding");
    await store.recordEvent(session, business.id, "onboarding_raw", { request: parsed.data, ...(placeRaw === undefined ? {} : { place: placeRaw }) });
    if (parsed.data.from === "example") await seedDemoBusiness(store, session, business);
    // The starters are written after this response, so the owner reaches the plan without waiting on the model.
    scheduleStarters(session, business);
    return json<CreateBusinessResponse>({ id: business.id, business }, 201);
  } catch (error) {
    return handleError(error, "POST /api/businesses");
  }
}

/** Delete this visitor's businesses, choices, cards, outbox and chat. The example business lives in code and stays. */
export async function DELETE() {
  try {
    await getStore().reset(await getSessionId());
    return json<DeleteBusinessesResponse>({ ok: true });
  } catch (error) {
    return handleError(error, "DELETE /api/businesses");
  }
}
