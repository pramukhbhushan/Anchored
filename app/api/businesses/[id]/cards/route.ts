import type { CardsResponse } from "@/lib/api/contract";
import { simulateSchema } from "@/lib/api/schemas";
import { simulateCard } from "@/lib/domain/cards";
import { chosenSkills } from "@/lib/domain/paths";
import { choicesForSkill, findBusiness, getChoices, getFeed, nextSimulationTurn } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

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

/** Add a simulated card from a chosen skill, then return the feed. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, simulateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const business = await findBusiness((await params).id);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    const choices = await getChoices(business);
    if (chosenSkills(business, choices).length === 0) return fail(409, "No agents are working yet. Choose Build on a workflow first.");
    const { skill } = parsed.data;
    if (skill && !chosenSkills(business, choices).includes(skill)) return fail(409, "That skill isn't in this business's stack.");

    const turn = await nextSimulationTurn(business.id);
    const card = simulateCard(business, skill ? choicesForSkill(business, choices, skill) : choices, turn);
    if (!card) return fail(409, "None of the chosen skills has an event to simulate yet.");
    await getStore().ensureCards(await getSessionId(), business.id, [card]);
    return json<CardsResponse>(await getFeed(business), 201);
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/cards");
  }
}
