import { describe, expect, it } from "vitest";
import { checkSend } from "@/lib/domain/executor";
import type { CardDraft } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the send rules plain code enforces after the owner approves.

// New York is on EST (UTC-5) in November 2026.
const NINE_PM_NEW_YORK = new Date("2026-11-07T02:00:00Z");
const TEN_AM_NEW_YORK = new Date("2026-11-07T15:00:00Z");
const NEW_YORK = "America/New_York";

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

describe("checkSend", () => {
  it("holds a text at 9 p.m. New York time", () => {
    expect(checkSend(TEXT, { now: NINE_PM_NEW_YORK, timeZone: NEW_YORK, hasConsent: true })).toEqual({
      ok: false,
      reason: "Quiet hours: texts wait until 8 a.m.",
    });
  });

  it("sends a text at 10 a.m. New York time", () => {
    expect(checkSend(TEXT, { now: TEN_AM_NEW_YORK, timeZone: NEW_YORK, hasConsent: true })).toEqual({ ok: true });
  });

  it("reads quiet hours in the business's own time zone", () => {
    // 2 a.m. UTC is 6 p.m. in Los Angeles.
    expect(checkSend(TEXT, { now: NINE_PM_NEW_YORK, timeZone: "America/Los_Angeles", hasConsent: true }).ok).toBe(true);
  });

  it("blocks a text without consent", () => {
    const result = checkSend(TEXT, { now: TEN_AM_NEW_YORK, timeZone: NEW_YORK, hasConsent: false });
    expect(result.ok).toBe(false);
  });

  it("never sends a locked card", () => {
    const locked: CardDraft = { ...TEXT, channel: "locked", action: "I'll handle it" };
    expect(checkSend(locked, { now: TEN_AM_NEW_YORK, timeZone: NEW_YORK, hasConsent: true }).ok).toBe(false);
  });

  it("refuses a text or email that answers an allergy question", () => {
    const ctx = { now: TEN_AM_NEW_YORK, timeZone: NEW_YORK, hasConsent: true };
    expect(checkSend({ ...TEXT, body: "The mole has no peanut allergens." }, ctx).ok).toBe(false);
    expect(checkSend({ ...TEXT, channel: "email", body: "Safe for allergies!" }, ctx).ok).toBe(false);
  });

  it("sends email at night and without text consent", () => {
    const email: CardDraft = { ...TEXT, channel: "email", action: "Send email" };
    expect(checkSend(email, { now: NINE_PM_NEW_YORK, timeZone: NEW_YORK, hasConsent: false })).toEqual({ ok: true });
  });

  it("always passes a list card", () => {
    const list: CardDraft = { ...TEXT, channel: "list", body: "Allergy note for the menu", action: "Add to list" };
    expect(checkSend(list, { now: NINE_PM_NEW_YORK, timeZone: NEW_YORK, hasConsent: false })).toEqual({ ok: true });
  });
});
