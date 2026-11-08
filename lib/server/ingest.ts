import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SKILLS } from "@/lib/domain/agents";
import { CARD_TEMPLATES, liveEventKey, simulateCard } from "@/lib/domain/cards";
import { ensureOptOut, mentionsAllergen } from "@/lib/domain/executor";
import { activeAgents, chosenSkills, resolveChoices } from "@/lib/domain/paths";
import type { BusinessProfile, KeyedCard, SkillId } from "@/lib/domain/types";
import { choicesForSkill } from "@/lib/server/data";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Turns one outside event into a card for the skill that handles it. The
// simulator route and the signed webhooks both call `ingestEvent`, with the
// session passed in, since a webhook has no visitor cookie. Each source accepts
// exactly its own fields; an event that asks about allergies becomes a locked
// card the owner answers personally.

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
  // A customer's text gets a reply from whichever front-desk skill is working.
  text: ["inquiry", "callback"],
  "invoice-late": ["nudger"],
};

/** Every source an event can come from. */
export const EVENT_SOURCES = Object.keys(SOURCE_SKILLS);

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
  text: z.strictObject({ from: phone, text: z.string().trim().min(1).max(1600), name: shortText.optional() }),
  "invoice-late": z.strictObject({
    name: shortText.optional(),
    email: z.string().trim().max(200).optional(),
    amount: z.number().nonnegative(),
    number: z.string().trim().max(40).optional(),
    kind: z.enum(["overdue", "failed"]),
  }),
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

/** Write dollars as "$240" or "$240.50". */
function dollars(value: number): string {
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
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
      // Without two prices showing a rise, the template's "charges more" would be a guess, so the card says only what arrived.
      if (before === undefined || after === undefined || after <= before) {
        return { ...card, title: `New invoice from ${supplier}`, body: `A new invoice came in from ${supplier}. Check it against your last one?` };
      }
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
      // The template names an agent that will act, but nothing reads a forwarded email's topic yet, so the card shows the email itself.
      return {
        ...card,
        title: `Forwarded email from ${from}: ${subject}`,
        body: text(payload, "text", 600) ?? "The email had no text.",
        reason: "You forwarded this email to your Anchored address. Read it and decide who handles it.",
        checks: ["Read from an email you forwarded", "No reply sent to anyone"],
        action: "Add it to your list",
        channel: "list",
      };
    }
    case "text": {
      const from = text(payload, "from") ?? "a customer";
      const who = name ?? from;
      return {
        ...card,
        title: `New text from ${who}`,
        // The customer's own words, so the owner can see what the reply answers.
        reason: `They wrote: "${text(payload, "text", 160) ?? ""}"`,
        body: ensureOptOut(`Thanks for texting ${business.name}! We got your message and will get back to you shortly.`),
        checks: ["They texted you first", "No price in the text"],
        action: "Send text",
        channel: "sms",
        to: from,
      };
    }
    case "invoice-late": {
      const owed = amount(payload, "amount") ?? 0;
      const number = text(payload, "number", 40);
      const invoice = number ? `invoice ${number}` : "your invoice";
      const first = name?.split(/\s+/)[0];
      const state = payload.kind === "failed" ? "is still open because the last payment didn't go through" : "is now past due";
      return {
        ...card,
        title: `${name ?? "A customer"} owes ${dollars(owed)}${number ? ` on invoice ${number}` : ""}`,
        body: `Hi${first ? ` ${first}` : ""}, a quick reminder that ${invoice} from ${business.name} for ${dollars(owed)} ${state}. Reply here with any questions. Thanks!`,
        reason: payload.kind === "failed" ? "Stripe couldn't collect the payment." : "Stripe marked the invoice overdue.",
        checks: ["Amount read from Stripe", "No late fee added"],
        action: "Send email",
        channel: "email",
        to: text(payload, "email", 200) ?? name ?? "customer",
        stake: owed,
      };
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

/** The result of one event: the stored card's key, or why no card was drafted. */
export type IngestResult = { readonly ok: true; readonly key: string } | { readonly ok: false; readonly status: number; readonly error: string };

/**
 * Record an event for `business` in `session` and draft a card from the skill that handles its source. A
 * `simulated` event counts toward the simulator's rotation; a `live` one, from a webhook, never does.
 */
export async function ingestEvent(session: string, business: BusinessProfile, source: string, rawPayload: unknown, origin: "simulated" | "live"): Promise<IngestResult> {
  // `hasOwn` keeps names like `constructor` from matching inherited object properties.
  if (!Object.hasOwn(SOURCE_SKILLS, source) || !Object.hasOwn(PAYLOADS, source)) {
    return { ok: false, status: 404, error: `Unknown event source. Use one of: ${EVENT_SOURCES.join(", ")}.` };
  }
  const check = PAYLOADS[source]?.safeParse(rawPayload);
  if (!check?.success) return { ok: false, status: 400, error: `This ${source} event is missing a field or has one it shouldn't: ${check?.error.issues[0]?.message ?? "invalid payload"}` };
  const payload = check.data;

  const store = getStore();
  const choices = resolveChoices(business, await store.getChoices(session, business.id));
  // Triage belongs to Internal Communications, which runs for every business.
  const chosen = new Set<SkillId>([...chosenSkills(business, choices), "triage"]);
  const candidates = SOURCE_SKILLS[source] ?? [];
  const skill = candidates.find((candidate) => chosen.has(candidate));
  if (!skill) {
    const names = candidates.map((candidate) => SKILLS[candidate].name).join(" or ");
    return { ok: false, status: 409, error: `Nothing in this plan handles a ${source} event. Let Anchored draft the workflow that uses ${names}.` };
  }
  // Store the event only once it is valid and some skill will act on it.
  await store.recordEvent(session, business.id, source, payload);

  const stored = await store.listCards(session, business.id);
  const turn = stored.filter((card) => card.key.includes(":sim:")).length + 1;
  // Triage has no workflow to narrow to, so its card comes straight from the template,
  // told which agents are at work so it only routes to one that exists.
  const card: KeyedCard | null =
    skill === "triage"
      ? { ...CARD_TEMPLATES.triage(business, turn, activeAgents(business, choices)), agent: "internal", skill: "triage", key: `${business.id}:sim:${turn}` }
      : simulateCard(business, choicesForSkill(business, choices, skill), turn);
  if (!card) return { ok: false, status: 409, error: "That skill has no card to draft for this event yet." };
  // An allergy question gets no drafted answer at all: the thread is locked for the owner to reply.
  const message = text(payload, "message", 2000) ?? text(payload, "text", 2000) ?? "";
  const drafted = mentionsAllergen(message) ? allergyLock(card, payload) : personalize(card, source, business, payload);
  // The random suffix keeps two events arriving together from sharing a key.
  const key = origin === "simulated" ? `${card.key}-${randomUUID().slice(0, 8)}` : liveEventKey(business.id, randomUUID());
  await store.ensureCards(session, business.id, [{ ...drafted, key }]);
  return { ok: true, key };
}
