import { z } from "zod";
import type { CardsResponse } from "@/lib/api/contract";
import { ingestSchema } from "@/lib/api/schemas";
import { SKILLS } from "@/lib/domain/agents";
import { CARD_TEMPLATES, simulateCard } from "@/lib/domain/cards";
import { chosenSkills } from "@/lib/domain/paths";
import type { BusinessProfile, KeyedCard, SkillId } from "@/lib/domain/types";
import { choicesForSkill, findBusiness, getChoices, getFeed, nextSimulationTurn } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/ingest/[source] turns an outside event into a card for the skill
// that handles it. This demo route trusts the visitor's session cookie; a real
// Twilio or form webhook must verify its signature and map to a business by
// phone number or forwarding address instead.

/** Event sources and the skill that drafts a card for each. */
const SOURCE_SKILL: Readonly<Record<string, SkillId>> = {
  "missed-call": "callback",
  "lead-form": "inquiry",
  "catering-form": "catering",
  invoice: "pricewatch",
  review: "reviewdrafter",
  booking: "showup",
  email: "triage",
};

// Each source accepts exactly these fields, so an event can't smuggle in extra data or oversized text.
const phone = z.string().trim().regex(/^\+?[0-9 ().-]{7,20}$/, "Use a phone number like +1 301 555 0192.");
const shortText = z.string().trim().min(1).max(80);
const PAYLOADS: Readonly<Record<string, z.ZodType<Readonly<Record<string, unknown>>>>> = {
  "missed-call": z.strictObject({ from: phone }),
  "lead-form": z.strictObject({ name: shortText, message: z.string().max(1000).optional() }),
  "catering-form": z.strictObject({ name: shortText, headcount: z.number().int().min(1).max(5000).optional(), date: z.string().max(40).optional(), message: z.string().max(1000).optional() }),
  invoice: z.strictObject({ supplier: shortText, item: shortText.optional(), oldPrice: z.number().nonnegative().optional(), newPrice: z.number().nonnegative().optional() }),
  review: z.strictObject({ author: shortText.optional(), text: z.string().trim().min(1).max(2000) }),
  booking: z.strictObject({ name: shortText, when: z.string().trim().min(1).max(60) }),
  email: z.strictObject({ from: z.string().trim().min(1).max(120), subject: z.string().trim().min(1).max(200), text: z.string().max(2000).optional() }),
};

/** Read a short string field from a validated payload, or `undefined`. */
function field(payload: Readonly<Record<string, unknown>>, name: string): string | undefined {
  const value = payload[name];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : undefined;
}

/** Fill a template card with the caller's or lead's details when the event carries them. */
function personalize(card: KeyedCard, source: string, business: BusinessProfile, payload: Readonly<Record<string, unknown>>): KeyedCard {
  const from = field(payload, "from");
  const name = field(payload, "name");
  if (source === "missed-call" && from) {
    return {
      ...card,
      title: `Missed call from ${from}`,
      to: from,
      body: `Sorry we missed you, this is ${business.name}. What can we help with? We can call you back within the hour, or reply with a better time. Reply STOP to opt out.`,
    };
  }
  if (source === "lead-form" && name) {
    return { ...card, title: `New inquiry from your website: ${name}`, to: name, body: `Hi ${name}, thanks for reaching out to ${business.name}! Could we talk tomorrow at 10 a.m. or 3 p.m.?` };
  }
  return card;
}

/** Record an event and draft a card from the skill that handles its source. */
export async function POST(request: Request, { params }: { params: Promise<{ source: string }> }) {
  const parsed = await readBody(request, ingestSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { source } = await params;
    // `hasOwn` keeps names like `constructor` from matching inherited object properties.
    if (!Object.hasOwn(SOURCE_SKILL, source)) return fail(404, `Unknown event source. Use one of: ${Object.keys(SOURCE_SKILL).join(", ")}.`);
    const skill = SOURCE_SKILL[source];
    const payloadSchema = PAYLOADS[source];
    if (!skill || !payloadSchema) return fail(404, "Unknown event source.");
    const payloadCheck = payloadSchema.safeParse(parsed.data.payload);
    if (!payloadCheck.success) return fail(400, `This ${source} event is missing a field or has one it shouldn't: ${payloadCheck.error.issues[0]?.message ?? "invalid payload"}`);
    const payload = payloadCheck.data;
    const business = await findBusiness(parsed.data.businessId);
    if (!business) return fail(404, "Business not found. It may have been reset.");

    const session = await getSessionId();
    const store = getStore();
    const choices = await getChoices(business);
    // Triage belongs to Internal Communications, which runs for every business.
    if (skill !== "triage" && !chosenSkills(business, choices).includes(skill)) {
      return fail(409, `The ${SKILLS[skill].name} skill isn't in this stack. Choose Build on that workflow to get a card.`);
    }
    // Store the event only once it is valid and some skill will act on it.
    await store.recordEvent(session, business.id, source, payload);

    const turn = await nextSimulationTurn(business.id);
    // Triage has no workflow to narrow to, so its card comes straight from the template.
    const card: KeyedCard | null =
      skill === "triage"
        ? { ...CARD_TEMPLATES.triage(business, turn), agent: "internal", skill: "triage", key: `${business.id}:sim:${turn}` }
        : simulateCard(business, choicesForSkill(business, choices, skill), turn);
    if (card) await store.ensureCards(session, business.id, [personalize(card, source, business, payload)]);
    return json<CardsResponse>(await getFeed(business), 201);
  } catch (error) {
    return handleError(error, "POST /api/ingest/[source]");
  }
}
