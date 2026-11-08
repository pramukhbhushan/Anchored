import { z } from "zod";
import type { EventCardResponse } from "@/lib/api/contract";
import { ingestSchema } from "@/lib/api/schemas";
import { SKILLS } from "@/lib/domain/agents";
import { CARD_TEMPLATES, simulateCard } from "@/lib/domain/cards";
import { mentionsAllergen } from "@/lib/domain/executor";
import { activeAgents, chosenSkills } from "@/lib/domain/paths";
import type { BusinessProfile, KeyedCard, SkillId } from "@/lib/domain/types";
import { addEventCard, choicesForSkill, findBusiness, getChoices, nextSimulationTurn } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/ingest/[source] turns an outside event into a card for the skill
// that handles it. It trusts the visitor's session, so a live Twilio
// or form webhook must verify its signature and map to a business by phone
// number or forwarding address instead.

/** Event sources and the skills that can draft a card for each, in order of preference. */
const SOURCE_SKILLS: Readonly<Record<string, readonly SkillId[]>> = {
  "missed-call": ["callback"],
  "lead-form": ["inquiry"],
  "catering-form": ["catering"],
  invoice: ["pricewatch"],
  // Service businesses ask for reviews and others reply to them; either skill handles a new review.
  review: ["reviewdrafter", "reviewer"],
  booking: ["showup"],
  email: ["triage"],
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

/** Read a string field from a validated payload, cut to `max`, or `undefined`. */
function text(payload: Readonly<Record<string, unknown>>, name: string, max = 80): string | undefined {
  const value = payload[name];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

/** Read a number field from a validated payload, or `undefined`. */
function amount(payload: Readonly<Record<string, unknown>>, name: string): number | undefined {
  const value = payload[name];
  return typeof value === "number" ? value : undefined;
}

/** Put the event's own details into the template card, so the owner sees what actually arrived. */
function personalize(card: KeyedCard, source: string, business: BusinessProfile, payload: Readonly<Record<string, unknown>>): KeyedCard {
  const name = text(payload, "name");
  switch (source) {
    case "missed-call": {
      const from = text(payload, "from") ?? "an unknown number";
      return { ...card, title: `Missed call from ${from}`, to: from, body: `Sorry we missed you, this is ${business.name}. What can we help with? We can call you back within the hour, or reply with a better time. Reply STOP to opt out.` };
    }
    case "lead-form":
      return name ? { ...card, title: `New inquiry from your website: ${name}`, to: name, body: `Hi ${name}, thanks for reaching out to ${business.name}! Could we talk tomorrow at 10 a.m. or 3 p.m.?` } : card;
    case "catering-form": {
      const headcount = amount(payload, "headcount");
      const date = text(payload, "date", 40);
      const size = headcount ? `Party of ${headcount}` : "Catering request";
      return name ? { ...card, title: `${size}${date ? ` on ${date}` : ""}, from ${name}`, to: name } : card;
    }
    case "invoice": {
      const supplier = text(payload, "supplier") ?? "your supplier";
      const item = text(payload, "item") ?? "an item";
      const before = amount(payload, "oldPrice");
      const after = amount(payload, "newPrice");
      if (before === undefined || after === undefined || after <= before) return { ...card, title: `New invoice from ${supplier}` };
      return { ...card, title: `${item} went up $${(after - before).toFixed(2)} at ${supplier}`, body: `${supplier}'s latest invoice charges $${after.toFixed(2)} for ${item}, up from $${before.toFixed(2)} last time. Add it to your list for the rep?` };
    }
    case "review": {
      const author = text(payload, "author") ?? "A customer";
      return { ...card, title: `New review from ${author}`, reason: `"${text(payload, "text", 140) ?? ""}"` };
    }
    case "booking": {
      const when = text(payload, "when", 60);
      return name && when ? { ...card, title: `Booking with ${name}, ${when}`, to: name } : card;
    }
    case "email": {
      const subject = text(payload, "subject", 120) ?? "a forwarded email";
      const from = text(payload, "from", 120) ?? "someone";
      return { ...card, title: `Forwarded email from ${from}: ${subject}` };
    }
    default:
      return card;
  }
}

/** Turn an event that asks about allergies into a locked card the owner must answer personally. */
function allergyLock(card: KeyedCard, payload: Readonly<Record<string, unknown>>): KeyedCard {
  const who = text(payload, "name") ?? text(payload, "author") ?? text(payload, "from") ?? "A customer";
  return {
    ...card,
    title: `Allergy question from ${who}`,
    body: `${who} asked about allergies. Anchored doesn't draft answers to allergy questions. Call them or reply yourself.`,
    reason: "An approved guess would become the business's own statement about someone's health.",
    checks: ["Thread locked until you write the reply"],
    action: "I'll handle it",
    channel: "locked",
  };
}

/** Record an event and draft a card from the skill that handles its source. */
export async function POST(request: Request, { params }: { params: Promise<{ source: string }> }) {
  const parsed = await readBody(request, ingestSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { source } = await params;
    // `hasOwn` keeps names like `constructor` from matching inherited object properties.
    if (!Object.hasOwn(SOURCE_SKILLS, source) || !Object.hasOwn(PAYLOADS, source)) {
      return fail(404, `Unknown event source. Use one of: ${Object.keys(SOURCE_SKILLS).join(", ")}.`);
    }
    const candidates = SOURCE_SKILLS[source] ?? [];
    const payloadCheck = PAYLOADS[source]?.safeParse(parsed.data.payload);
    if (!payloadCheck?.success) return fail(400, `This ${source} event is missing a field or has one it shouldn't: ${payloadCheck?.error.issues[0]?.message ?? "invalid payload"}`);
    const payload = payloadCheck.data;
    const business = await findBusiness(parsed.data.businessId);
    if (!business) return fail(404, "Business not found. It may have been reset.");

    const choices = await getChoices(business);
    // Triage belongs to Internal Communications, which runs for every business.
    const chosen = new Set<SkillId>([...chosenSkills(business, choices), "triage"]);
    const skill = candidates.find((candidate) => chosen.has(candidate));
    if (!skill) {
      const names = candidates.map((candidate) => SKILLS[candidate].name).join(" or ");
      return fail(409, `No skill in this stack handles a ${source} event. Choose Build on the workflow that uses ${names}.`);
    }
    // Store the event only once it is valid and some skill will act on it.
    await getStore().recordEvent(await getSessionId(), business.id, source, payload);

    const turn = await nextSimulationTurn(business.id);
    // Triage has no workflow to narrow to, so its card comes straight from the template,
    // told which agents are at work so it only routes to one that exists.
    const card: KeyedCard | null =
      skill === "triage"
        ? { ...CARD_TEMPLATES.triage(business, turn, activeAgents(business, choices)), agent: "internal", skill: "triage", key: `${business.id}:sim:${turn}` }
        : simulateCard(business, choicesForSkill(business, choices, skill), turn);
    if (!card) return fail(409, "That skill has no card to draft for this event yet.");
    // An allergy question gets no drafted answer at all: the thread is locked for the owner to reply.
    const message = text(payload, "message", 2000) ?? text(payload, "text", 2000) ?? "";
    const result = mentionsAllergen(message) ? allergyLock(card, payload) : personalize(card, source, business, payload);
    return json<EventCardResponse>(await addEventCard(business, result), 201);
  } catch (error) {
    return handleError(error, "POST /api/ingest/[source]");
  }
}
