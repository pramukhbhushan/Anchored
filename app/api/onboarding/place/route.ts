import type { PlacesDetailResponse } from "@/lib/api/contract";
import { placesDetailSchema } from "@/lib/api/schemas";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { placeDetails } from "@/lib/server/places";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/onboarding/place reads the selected Google listing with a bounded
// field mask. It returns sourced profile candidates, not silently accepted
// facts, and stores nothing by itself.

/** Read one selected Google listing into sourced profile candidates. */
export async function POST(request: Request) {
  const parsed = await readBody(request, placesDetailSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const facts = await placeDetails(parsed.data.placeId);
    if (facts === null) return fail(503, "Business lookup is unavailable right now. Continue without it.");
    return json<PlacesDetailResponse>({ placeId: parsed.data.placeId, candidates: facts.candidates, website: facts.website });
  } catch (error) {
    return handleError(error, "POST /api/onboarding/place");
  }
}
