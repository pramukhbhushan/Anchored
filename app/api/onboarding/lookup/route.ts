import type { PlacesLookupResponse } from "@/lib/api/contract";
import { placesLookupSchema } from "@/lib/api/schemas";
import { handleError, json, readBody } from "@/lib/server/http";
import { searchPlaces } from "@/lib/server/places";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/onboarding/lookup finds up to three Google listing matches for the
// business name and city the owner typed. The API key never reaches the browser.

/** Find Google listing choices for one business name and city. */
export async function POST(request: Request) {
  const parsed = await readBody(request, placesLookupSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return json<PlacesLookupResponse>({ choices: await searchPlaces(parsed.data.name, parsed.data.city) });
  } catch (error) {
    return handleError(error, "POST /api/onboarding/lookup");
  }
}
