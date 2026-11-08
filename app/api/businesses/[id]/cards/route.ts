import type { CardsResponse, EventCardResponse } from "@/lib/api/contract";
import { simulateSchema } from "@/lib/api/schemas";
import { simulateCard } from "@/lib/domain/cards";
import { chosenSkills } from "@/lib/domain/paths";
import { addEventCard, choicesForSkill, findBusiness, getChoices, getFeed, nextSimulationTurn } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";

// =============================================================================
// Module Overview
// =============================================================================
// GET returns a business's card feed and simulated outbox. POST simulates a new
// event for one of the chosen skills, the way a missed call or a new invoice
// would arrive, and returns the updated feed.

/** Return the feed for the business. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const business = await findBusiness((await params).id);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    return json<CardsResponse>(await getFeed(business));
  } catch (error) {
    return handleError(error, "GET /api/businesses/[id]/cards");
  }
}

/** Add an example event's card from a chosen skill on the example business, then return the feed. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, simulateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const business = await findBusiness((await params).id);
    if (!business) return fail(404, "Business not found. It may have been deleted.");
    // Example events show a visitor how agents draft; an owner's own cards come from real events.
    if (business.kind !== "case") return fail(409, "Example events run only on the example business.");
    const choices = await getChoices(business);
    if (chosenSkills(business, choices).length === 0) return fail(409, "No agents are working yet. On the Workflows page, let Anchored draft a job for your OK first.");
    const { skill } = parsed.data;
    if (skill && !chosenSkills(business, choices).includes(skill)) return fail(409, "That skill isn't in this business's stack.");

    const turn = await nextSimulationTurn(business.id);
    const card = simulateCard(business, skill ? choicesForSkill(business, choices, skill) : choices, turn);
    if (!card) return fail(409, "None of the chosen skills has an event to simulate yet.");
    return json<EventCardResponse>(await addEventCard(business, card), 201);
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/cards");
  }
}
