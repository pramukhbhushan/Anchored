import { describe, expect, it } from "vitest";
import { rulesFor } from "@/lib/domain/agents";
import { caseStudyById } from "@/lib/domain/cases";
import type { BusinessProfile, SignalId, TradeKey } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the rules list a business's profile shows: the rules every
// business works under, and the allergy rule only where food is sold.

function caseStudy(id: string): BusinessProfile {
  const found = caseStudyById(id);
  if (found === undefined) throw new Error(`no case study \`${id}\``);
  return found;
}

function business(tradeKey: TradeKey, signals: readonly SignalId[]): Pick<BusinessProfile, "tradeKey" | "signals"> {
  return { tradeKey, signals };
}

const mentions = (rules: readonly string[], word: RegExp): boolean => rules.some((rule) => word.test(rule));

describe("rulesFor", () => {
  it("gives an HVAC shop quiet hours, consent, opt-out and allowed offers, but no allergy rule", () => {
    const rules = rulesFor(caseStudy("hvac"));
    expect(mentions(rules, /8 p\.m\. to 8 a\.m\./)).toBe(true);
    expect(mentions(rules, /agreed/)).toBe(true);
    expect(mentions(rules, /Reply STOP to opt out\./)).toBe(true);
    expect(rules).toContain("No prices or offers outside the ones you allow.");
    expect(mentions(rules, /allerg/i)).toBe(false);
  });

  it("adds the allergy rule for a restaurant, and keeps every other rule", () => {
    const hvacRules = rulesFor(caseStudy("hvac"));
    const restaurantRules = rulesFor(caseStudy("restaurant"));
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
