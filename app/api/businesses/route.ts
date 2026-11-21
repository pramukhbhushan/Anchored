import { randomUUID } from "node:crypto";
import type { CreateBusinessResponse, DeleteBusinessesResponse } from "@/lib/api/contract";
import { createBusinessSchema } from "@/lib/api/schemas";
import { EXAMPLES, exampleProfile } from "@/lib/domain/cases";
import { withCrewDecisions } from "@/lib/domain/crew";
import { mergeCandidates } from "@/lib/domain/details";
import { profileFromSentence } from "@/lib/domain/engine";
import type { BusinessProfile } from "@/lib/domain/types";
import { buildProfileFromAnswers, saveNewBusiness } from "@/lib/server/create-business";
import { resetSession } from "@/lib/server/data";
import { extractDetails } from "@/lib/server/extract";
import { fetchPage } from "@/lib/server/fetch-page";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/businesses builds a business from onboarding answers, an example
// or one sentence, and saves it to the visitor's session. The rules engine maps
// it; the configured AI provider, if any, only rewrites the text in the owner's words.
// DELETE removes everything the visitor saved: their businesses and every choice,
// card and outbox message, including what they changed on the example business.

/** Build the profile for a validated request, or return `null` for an unknown example. */
async function buildProfile(session: string, request: ReturnType<typeof createBusinessSchema.parse>): Promise<BusinessProfile | null> {
  if (request.from === "example") {
    if (!EXAMPLES.some((example) => example.id === request.exampleId)) return null;
    // Each visitor gets their own copy, so their choices never touch the shared example.
    return { ...exampleProfile(request.exampleId), id: `b_${randomUUID()}`, kind: "custom" };
  }
  if (request.from === "sentence") return profileFromSentence(request.sentence);
  return buildProfileFromAnswers(session, request.answers);
}

/** Create a business for this session. */
export async function POST(request: Request) {
  const parsed = await readBody(request, createBusinessSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const session = await getSessionId();
    const built = await buildProfile(session, parsed.data);
    if (!built) return fail(400, "That example doesn't exist. Pick one from the list.");
    let business = withCrewDecisions(built);
    let website: { readonly url: string; readonly title: string; readonly text: string } | undefined;
    const sourceWebsite = parsed.data.from === "answers" ? parsed.data.answers.website : undefined;
    if (sourceWebsite !== undefined) {
      const page = await fetchPage(sourceWebsite);
      if (page !== null) {
        const merged = mergeCandidates(
          { details: business.details ?? {}, evidence: business.evidence ?? {} },
          await extractDetails(session, "website", page.text),
        );
        business = { ...business, details: merged.details, evidence: merged.evidence };
        website = { url: page.url, title: page.title, text: page.text };
      }
    }
    const raw = { request: parsed.data, ...(website === undefined ? {} : { website }) };
    await saveNewBusiness(session, business, raw, { seedExample: parsed.data.from === "example" });
    return json<CreateBusinessResponse>({ id: business.id, business }, 201);
  } catch (error) {
    return handleError(error, "POST /api/businesses");
  }
}

/** Delete this visitor's businesses, choices, cards, outbox and chat. The example business lives in code and stays. */
export async function DELETE() {
  try {
    await resetSession(await getSessionId());
    return json<DeleteBusinessesResponse>({ ok: true });
  } catch (error) {
    return handleError(error, "DELETE /api/businesses");
  }
}
