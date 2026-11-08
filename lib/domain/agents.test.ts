import { describe, expect, it } from "vitest";
import { rulesFor, SKILLS } from "@/lib/domain/agents";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import type { BusinessProfile, SignalId, TradeKey } from "@/lib/domain/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the rules list a business's profile shows: the rules every
// business works under, and the allergy rule only where food is sold.

function business(tradeKey: TradeKey, signals: readonly SignalId[]): Pick<BusinessProfile, "tradeKey" | "signals"> {
  return { tradeKey, signals };
}

const mentions = (rules: readonly string[], word: RegExp): boolean => rules.some((rule) => word.test(rule));

describe("rulesFor", () => {
  it("gives an HVAC shop quiet hours, consent, opt-out and allowed offers, but no allergy rule", () => {
    const rules = rulesFor(hvacShop());
    expect(mentions(rules, /8 p\.m\. to 8 a\.m\./)).toBe(true);
    expect(mentions(rules, /agreed/)).toBe(true);
    expect(mentions(rules, /Reply STOP to opt out\./)).toBe(true);
    expect(rules).toContain("No prices or offers outside the ones you allow.");
    expect(mentions(rules, /allerg/i)).toBe(false);
  });

  it("adds the allergy rule for a restaurant, and keeps every other rule", () => {
    const hvacRules = rulesFor(hvacShop());
    const restaurantRules = rulesFor(SAMPLE_BUSINESS);
    expect(mentions(restaurantRules, /allerg/i)).toBe(true);
    expect(restaurantRules).toEqual(expect.arrayContaining(hvacRules));
  });

  it("treats corner stores, caterers and SNAP sellers as food businesses", () => {
    expect(mentions(rulesFor(business("store", [])), /allerg/i)).toBe(true);
    expect(mentions(rulesFor(business("any", ["catering"])), /allerg/i)).toBe(true);
    expect(mentions(rulesFor(business("any", ["snap"])), /allerg/i)).toBe(true);
    expect(mentions(rulesFor(business("coach", ["appointments"])), /allerg/i)).toBe(false);
  });
});

describe("SKILLS setup steps", () => {
  // Anchored has no phone numbers of its own, no web form, no file upload and no photo reading: the owner
  // connects their own Twilio number, Stripe and a forwarding address, adds customers on Connections, and asks in chat.
  const missing = /Anchored (phone )?number|form link|\bupload|photograph|tap '/i;

  it.each(Object.values(SKILLS).map((skill) => [skill.name, skill] as const))("asks %s's owner only for steps the app has today", (_, skill) => {
    expect(skill.setup.filter((step) => missing.test(step))).toEqual([]);
    expect(skill.reads.filter((source) => missing.test(source))).toEqual([]);
  });
});
