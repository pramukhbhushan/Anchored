import "server-only";
import { z } from "zod";
import type { DetailCandidate } from "@/lib/domain/details";
import type { ListingChoice } from "@/lib/domain/intake";

// =============================================================================
// Module Overview
// =============================================================================
// The "Is this you?" lookup on Google Places (New). `searchPlaces` finds up to
// three matches for a name and town; `placeDetails` reads one listing's address,
// phone, hours, website and review link as candidates at the listing tier, which the owner
// confirms before they are kept. Both ask for the fewest fields that do the job,
// since Google bills by field, and both return nothing rather than throw.
// Google's terms limit caching Places content: only the place id is stored
// once onboarding ends, plus whatever the owner confirmed as their own.

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress,places.rating";
// Reviews are left out: no profile field keeps them, and their text may not be stored.
const DETAIL_FIELDS = "id,displayName,formattedAddress,nationalPhoneNumber,regularOpeningHours,websiteUri,types,editorialSummary,rating,userRatingCount,reviews";
const TIMEOUT_MS = 6000;

const searchSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        displayName: z.object({ text: z.string() }).optional(),
        formattedAddress: z.string().optional(),
        rating: z.number().optional(),
      }),
    )
    .optional(),
});

const detailsSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  regularOpeningHours: z.object({ weekdayDescriptions: z.array(z.string()).optional() }).optional(),
  websiteUri: z.string().optional(),
  types: z.array(z.string()).optional(),
  editorialSummary: z.object({ text: z.string() }).optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  reviews: z.array(z.object({ text: z.object({ text: z.string() }).optional() })).max(5).optional(),
});

/** What one listing gives onboarding: candidates plus short-lived source text to extract before it is discarded. */
export interface PlaceFacts {
  readonly candidates: readonly DetailCandidate[];
  readonly website: string | null;
  readonly listingText: string;
  readonly reviewText: string;
}

function apiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key ? key : null;
}

/** Whether the business lookup is set up on this server. */
export function isPlacesConfigured(): boolean {
  return apiKey() !== null;
}

/** Up to three listings matching `name` in `town`, or none when the lookup is off or fails. */
export async function searchPlaces(name: string, town: string): Promise<ListingChoice[]> {
  const key = apiKey();
  if (key === null || name.trim() === "" || town.trim() === "") return [];
  try {
    const response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": SEARCH_FIELDS },
      body: JSON.stringify({ textQuery: `${name}, ${town}`, maxResultCount: 3 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Places search answered ${response.status}.`);
    const parsed = searchSchema.parse(await response.json());
    return (parsed.places ?? []).slice(0, 3).map((place) => ({
      id: place.id,
      name: (place.displayName?.text ?? name).slice(0, 60),
      address: (place.formattedAddress ?? "").slice(0, 80),
      ...(place.rating !== undefined ? { rating: place.rating } : {}),
    }));
  } catch (error) {
    console.warn(`[Places] Search failed; onboarding goes on without it. Reason: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/** The link customers use to review a listing on Google, built from its place id. */
export function reviewLinkFor(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/** One listing's profile candidates and short-lived extraction text, or `null` when lookup is off or fails. */
export async function placeDetails(placeId: string): Promise<PlaceFacts | null> {
  const key = apiKey();
  if (key === null) return null;
  try {
    const response = await fetch(`${DETAILS_URL}${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": DETAIL_FIELDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Places details answered ${response.status}.`);
    const place = detailsSchema.parse(await response.json());
    const candidates: DetailCandidate[] = [];
    if (place.formattedAddress) {
      candidates.push({ key: "address", value: place.formattedAddress, sourceType: "listing", quote: place.formattedAddress, confidence: "high" });
    }
    if (place.nationalPhoneNumber) {
      candidates.push({ key: "businessPhone", value: place.nationalPhoneNumber, sourceType: "listing", quote: place.nationalPhoneNumber, confidence: "high" });
    }
    const days = place.regularOpeningHours?.weekdayDescriptions ?? [];
    if (days.length > 0) {
      // Google writes ranges with an en dash and thin spaces; the owner reads "9:00 AM to 5:00 PM".
      const hours = days.join("; ").replace(/[\u202f\u2009]/g, " ").replace(/\s*[\u2013\u2014]\s*/g, " to ").slice(0, 160);
      candidates.push({ key: "hours", value: hours, sourceType: "listing", quote: hours, confidence: "high" });
    }
    candidates.push({ key: "reviewLink", value: reviewLinkFor(place.id), sourceType: "listing", quote: "Your Google listing's review link", confidence: "high" });
    const website = place.websiteUri && /^https?:\/\//i.test(place.websiteUri) ? place.websiteUri : null;
    const listingText = [
      place.displayName?.text,
      place.editorialSummary?.text,
      place.types?.length ? `Business types: ${place.types.join(", ")}` : undefined,
    ].filter((part): part is string => Boolean(part)).join("\n");
    const reviewText = [
      place.rating === undefined ? undefined : `Overall rating: ${place.rating} from ${place.userRatingCount ?? "an unknown number of"} reviews.`,
      ...(place.reviews ?? []).map((review) => review.text?.text).filter((text): text is string => Boolean(text)),
    ].filter((part): part is string => Boolean(part)).join("\n");
    return { candidates, website, listingText, reviewText };
  } catch (error) {
    console.warn(`[Places] Details failed; onboarding goes on without them. Reason: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
