import { describe, expect, it } from "vitest";
import { checkSend, ensureOptOut, findPlaceholder, mentionsAllergen } from "@/lib/domain/executor";
import type { CardDraft } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the send rules plain code enforces after the owner approves.

// New York is on EST (UTC-5) in November 2026.
const NINE_PM_NEW_YORK = new Date("2026-11-07T02:00:00Z");
const TEN_AM_NEW_YORK = new Date("2026-11-07T15:00:00Z");
const NEW_YORK = "America/New_York";
const DAYTIME = { now: TEN_AM_NEW_YORK, timeZone: NEW_YORK, hasConsent: true };

const TEXT: CardDraft = {
  agent: "frontdesk",
  skill: "callback",
  title: "Missed call",
  body: "Sorry we missed you. We can call you back at 4 p.m. Reply STOP to opt out.",
  reason: "Callers who wait often try someone else.",
  checks: [],
  action: "Send text",
  channel: "sms",
  to: "(410) 555-0137",
};

const EMAIL: CardDraft = { ...TEXT, channel: "email", action: "Send email" };

// The two replies that got past the old one-word allergy check, and a zero-width variant of the first.
const PEANUT_FREE_CLAIM = "our mole is 100% peanut free and nut free, totally safe for your son";
const SPANISH_ALLERGY_ANSWER = "Sí, el mole no tiene cacahuates, es seguro para su alergia.";
const ZERO_WIDTH_CLAIM = "our mole is 100% pea​nut free and n‍ut fr​ee, totally safe for your son";

describe("checkSend", () => {
  it("holds a text at 9 p.m. New York time", () => {
    expect(checkSend(TEXT, { now: NINE_PM_NEW_YORK, timeZone: NEW_YORK, hasConsent: true })).toEqual({
      ok: false,
      reason: "Quiet hours: texts wait until 8 a.m.",
    });
  });

  it("sends a text at 10 a.m. New York time", () => {
    expect(checkSend(TEXT, DAYTIME)).toEqual({ ok: true });
  });

  it("reads quiet hours in the business's own time zone", () => {
    // 2 a.m. UTC is 6 p.m. in Los Angeles.
    expect(checkSend(TEXT, { now: NINE_PM_NEW_YORK, timeZone: "America/Los_Angeles", hasConsent: true }).ok).toBe(true);
  });

  it("blocks a text without consent", () => {
    const result = checkSend(TEXT, { ...DAYTIME, hasConsent: false });
    expect(result.ok).toBe(false);
  });

  it("never sends a locked card", () => {
    const locked: CardDraft = { ...TEXT, channel: "locked", action: "I'll handle it" };
    expect(checkSend(locked, DAYTIME).ok).toBe(false);
  });

  it("refuses a text or email that answers an allergy question", () => {
    expect(checkSend({ ...TEXT, body: "The mole has no peanut allergens." }, DAYTIME).ok).toBe(false);
    expect(checkSend({ ...EMAIL, body: "Safe for allergies!" }, DAYTIME).ok).toBe(false);
  });

  it.each([
    ["an English nut-free claim", PEANUT_FREE_CLAIM],
    ["a Spanish allergy answer", SPANISH_ALLERGY_ANSWER],
    ["a claim hidden with zero-width characters", ZERO_WIDTH_CLAIM],
  ])("refuses %s by text and by email", (_label, claim) => {
    const textResult = checkSend({ ...TEXT, body: `${claim} Reply STOP to opt out.` }, DAYTIME);
    expect(textResult).toEqual({ ok: false, reason: expect.stringContaining("allergen") });
    expect(checkSend({ ...EMAIL, body: claim }, DAYTIME).ok).toBe(false);
  });

  it("still never sends a locked card about allergies, and still passes a list card", () => {
    expect(checkSend({ ...TEXT, channel: "locked", body: SPANISH_ALLERGY_ANSWER }, DAYTIME).ok).toBe(false);
    expect(checkSend({ ...TEXT, channel: "list", body: PEANUT_FREE_CLAIM }, DAYTIME)).toEqual({ ok: true });
  });

  it("refuses a text that doesn't end with the opt-out line, and says what to add", () => {
    const result = checkSend({ ...TEXT, body: "Sorry we missed you. We can call you back at 4 p.m." }, DAYTIME);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('"Reply STOP to opt out."') });
  });

  it("refuses a text whose opt-out line isn't at the end", () => {
    expect(checkSend({ ...TEXT, body: "Reply STOP to opt out. See you at 4 p.m." }, DAYTIME).ok).toBe(false);
  });

  it("sends an email without the opt-out line", () => {
    expect(checkSend({ ...EMAIL, body: "See you at 4 p.m." }, DAYTIME)).toEqual({ ok: true });
  });

  it("refuses a text or email that still has a placeholder, naming it", () => {
    const blank = "A Google review helps neighbors find us: [your review link]. Reply STOP to opt out.";
    const reason = "Fill in [your review link] before sending.";
    expect(checkSend({ ...TEXT, body: blank }, DAYTIME)).toEqual({ ok: false, reason });
    expect(checkSend({ ...EMAIL, body: blank }, DAYTIME)).toEqual({ ok: false, reason });
  });

  it("sends email at night and without text consent", () => {
    expect(checkSend(EMAIL, { now: NINE_PM_NEW_YORK, timeZone: NEW_YORK, hasConsent: false })).toEqual({ ok: true });
  });

  it("always passes a list card", () => {
    const list: CardDraft = { ...TEXT, channel: "list", body: "Allergy note for the menu", action: "Add to list" };
    expect(checkSend(list, { now: NINE_PM_NEW_YORK, timeZone: NEW_YORK, hasConsent: false })).toEqual({ ok: true });
  });
});

describe("mentionsAllergen", () => {
  it.each([
    ["the English nut-free claim", PEANUT_FREE_CLAIM],
    ["the Spanish allergy answer", SPANISH_ALLERGY_ANSWER],
    ["zero-width characters inside the words", ZERO_WIDTH_CLAIM],
    ["Cyrillic letters that look Latin", "No pеаnuts in the mole, АLLЕRGY safe."],
    ["Greek capitals that look Latin", "ΝΟT Α PEΑΝUT IN SIGHT"],
    ["fullwidth letters", "ＰＥＡＮＵＴ free"],
    ["a Spanish peanut word with its accent", "No lleva maní."],
    ["an EpiPen", "Bring your epi-pen just in case."],
    ["gluten", "The tortillas are gluten free."],
    ["Korean", "땅콩은 들어가지 않아요."],
    ["Chinese", "这道菜没有花生。"],
  ])("flags %s", (_label, text) => {
    expect(mentionsAllergen(text)).toBe(true);
  });

  it("passes ordinary replies", () => {
    expect(mentionsAllergen("Hi Maria, we can be there today between 3 and 5 p.m. Reply STOP to opt out.")).toBe(false);
    expect(mentionsAllergen("For 40 people we offer a taco bar, bowls with sides, or family-style platters.")).toBe(false);
  });

  it("reads Spanish 'soy' as 'I am' but still flags soy as a food", () => {
    expect(mentionsAllergen("Hola, soy Dana de Linden Street Kitchen.")).toBe(false);
    expect(mentionsAllergen("Is the marinade soy-free?")).toBe(true);
    expect(mentionsAllergen("The glaze contains soy sauce.")).toBe(true);
  });
});

describe("ensureOptOut", () => {
  it("adds the opt-out line to a text that lacks it", () => {
    expect(ensureOptOut("Hi Dana, checking in on the quote.")).toBe(
      "Hi Dana, checking in on the quote. Reply STOP to opt out.",
    );
  });

  it("leaves a text that already ends with it", () => {
    expect(ensureOptOut(TEXT.body)).toBe(TEXT.body);
    expect(ensureOptOut(ensureOptOut("Hi Dana."))).toBe("Hi Dana. Reply STOP to opt out.");
  });

  it("never doubles the line when it is misspelled or in the wrong place", () => {
    expect(ensureOptOut("Hi Dana. reply stop to opt out")).toBe("Hi Dana. Reply STOP to opt out.");
    expect(ensureOptOut("Reply STOP to opt out. See you Friday.")).toBe("See you Friday. Reply STOP to opt out.");
  });

  it("makes a text pass the opt-out rule", () => {
    const body = ensureOptOut("We can call you back at 4 p.m.");
    expect(checkSend({ ...TEXT, body }, DAYTIME)).toEqual({ ok: true });
  });
});

describe("findPlaceholder", () => {
  it("finds a bracketed blank the owner still has to fill", () => {
    expect(findPlaceholder("Here's the link: [payment link]. Thanks!")).toBe("[payment link]");
  });

  it("finds nothing in a finished draft", () => {
    expect(findPlaceholder("If paying online is easier, I'll send the link next. Thanks!")).toBeNull();
  });
});
