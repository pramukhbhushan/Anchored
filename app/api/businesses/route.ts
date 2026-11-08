import { randomUUID } from "node:crypto";
import type { CreateBusinessResponse, DeleteBusinessesResponse } from "@/lib/api/contract";
import { createBusinessSchema } from "@/lib/api/schemas";
import { EXAMPLES, exampleProfile } from "@/lib/domain/cases";
import { profileFromSentence } from "@/lib/domain/engine";
import type { BusinessProfile } from "@/lib/domain/types";
import { buildProfileFromAnswers } from "@/lib/server/create-business";
import { fail, handleError, json, readBody } from "@/lib/server/http";
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
    const business = await buildProfile(parsed.data);
    if (!business) return fail(400, "That example doesn't exist. Pick one from the list.");
    const session = await getSessionId();
    await getStore().saveBusiness(session, business);
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
