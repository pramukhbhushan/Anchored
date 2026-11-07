import { afterEach, describe, expect, it, vi } from "vitest";
import { EXAMPLES, exampleProfile } from "@/lib/domain/cases";
import { detectTradeKey, hintFor, profileFromAnswers, profileFromFacts, profileFromSentence } from "@/lib/domain/engine";
import type { BusinessFacts, BusinessProfile, OnboardingAnswers } from "@/lib/domain/types";
import { BASE_WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the rules engine: which workflows a business's facts produce,
// which path each gets, and how onboarding answers and sentences become profiles.

const BLANK_ANSWERS: OnboardingAnswers = {
  name: "",
  kind: "",
  what: "",
  week: "",
  voice: "",
  reach: [],
  tools: [],
  signals: [],
  languages: [],
};

const BLANK_FACTS: BusinessFacts = { name: "Taco Loco", trade: "Taco truck", tradeKey: "restaurant", reach: [], tools: [], signals: [] };

function example(id: string): (typeof EXAMPLES)[number] {
  const found = EXAMPLES.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no example \`${id}\``);
  return found;
}

describe("workflows from facts", () => {
  const engineProfiles: BusinessProfile[] = [
    ...EXAMPLES.map((candidate) => exampleProfile(candidate.id)),
    profileFromSentence("I run a bakery with 9 staff and we cater weddings"),
    profileFromSentence("an accounting office"),
    profileFromAnswers(BLANK_ANSWERS),
  ];

  it.each(engineProfiles.map((business) => [business.name, business] as const))(
    "%s includes the five base workflows",
    (_name, business) => {
      for (const id of BASE_WORKFLOWS) expect(business.workflows[id]).toBeDefined();
    },
  );

  it("gives the corner store SNAP, supplier invoice and license workflows", () => {
    const corner = exampleProfile("corner");
    expect(corner.workflows.snap).toBeDefined();
    expect(corner.workflows.invoices).toBeDefined();
    expect(corner.workflows.licenses).toBeDefined();
  });

  it("recommends turning on Square's scheduling for the salon because it uses Square", () => {
    expect(exampleProfile("salon").workflows.scheduling?.rec).toBe("turnon");
    const withoutSquare = profileFromFacts({ ...example("salon"), tools: [] });
    expect(withoutSquare.workflows.scheduling?.rec).toBe("buy");
  });

  it("never applies a trade hint: a restaurant with no signals gets no supplier workflow", () => {
    const restaurant = profileFromAnswers({
      ...BLANK_ANSWERS,
      name: "Taco Loco",
      kind: "Taco restaurant",
      reach: ["Walk-ins"],
    });
    expect(restaurant.tradeKey).toBe("restaurant");
    expect(hintFor("Taco restaurant").signals).toContain("suppliers");
    expect(restaurant.workflows.invoices).toBeUndefined();
    expect(restaurant.signals).toEqual([]);
  });

  it("skips workflows that fit too little to act on", () => {
    const counterOnly = exampleProfile("corner");
    expect(counterOnly.workflows.calls).toMatchObject({ fit: 0, rec: "skip" });
    expect(counterOnly.workflows.books).toMatchObject({ fit: 1, rec: "skip" });
  });

  it("says phone calls weren't mentioned rather than claiming customers don't call", () => {
    const why = exampleProfile("corner").workflows.calls?.why;
    expect(why).toContain("weren't mentioned");
    expect(why).not.toContain("don't usually reach you");
  });

  it("treats catering requests as leads even when nothing arrives in writing", () => {
    const caterer = profileFromFacts({ ...BLANK_FACTS, reach: ["Walk-ins"], signals: ["catering"] });
    expect(caterer.workflows.leads?.fit).toBeGreaterThanOrEqual(2);
    expect(caterer.workflows.leads?.why).not.toContain("on the spot");
    const walkInsOnly = profileFromFacts({ ...BLANK_FACTS, reach: ["Walk-ins"] });
    expect(walkInsOnly.workflows.leads?.fit).toBe(1);
  });
});

describe("profiles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cuts the customers text at a word, not mid-word", () => {
    const profile = profileFromAnswers({
      ...BLANK_ANSWERS,
      what: "Families and offices around Austin who order tacos and catering, with trays from $60. Setup is free.",
    });
    expect(profile.customers).toBe(
      "From your answers: Families and offices around Austin who order tacos and catering, with trays from $60...",
    );
  });

  it("keeps a short customers answer whole, and a blank one reads as not given", () => {
    expect(profileFromAnswers({ ...BLANK_ANSWERS, what: "Office lunches" }).customers).toBe("From your answers: Office lunches");
    expect(profileFromAnswers(BLANK_ANSWERS).customers).toBe("Not given");
  });

  it("splits weekly tasks on commas and line breaks, keeping 'and' inside a task", () => {
    const profile = profileFromAnswers({
      ...BLANK_ANSWERS,
      week: "Answer calls and texts, chase catering quotes\nOrder supplies and stock",
    });
    expect(profile.tasks).toEqual(["Answer calls and texts", "chase catering quotes", "Order supplies and stock"]);
  });

  it("mints ids where browsers lack `crypto.randomUUID`, as on a LAN address over plain HTTP", () => {
    const realCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) });
    expect(profileFromSentence("a bakery").id).toMatch(/^b_[0-9a-f]{32}$/);
    vi.stubGlobal("crypto", undefined);
    const first = profileFromSentence("a bakery").id;
    expect(first).toMatch(/^b_[0-9a-z]+$/);
    expect(profileFromSentence("a bakery").id).not.toBe(first);
  });

  it("splits the business name from its place at the first comma", () => {
    const profile = profileFromAnswers({ ...BLANK_ANSWERS, name: "Taco Loco, Austin, TX", kind: "Taco truck" });
    expect(profile.name).toBe("Taco Loco");
    expect(profile.place).toBe("Austin, TX");
  });

  it("fills blank answers with plain defaults", () => {
    const profile = profileFromAnswers(BLANK_ANSWERS);
    expect(profile).toMatchObject({
      name: "Your business",
      trade: "Small business",
      tradeKey: "any",
      place: "Not given",
      languages: ["English"],
      tools: ["Paper and phone"],
      kind: "custom",
      builtBy: "rules",
    });
    expect(profile.tasks.length).toBeGreaterThan(0);
  });

  it("mints a fresh id for each engine profile, and a stable one for examples", () => {
    const first = profileFromSentence("a bakery");
    const second = profileFromSentence("a bakery");
    expect(first.id).toMatch(/^b_/);
    expect(first.id).not.toBe(second.id);
    expect(exampleProfile("dental").id).toBe("ex-dental");
  });

  it("reads signals and software from the words of a sentence", () => {
    const profile = profileFromSentence("I run a corner store that takes SNAP and uses Square");
    expect(profile.trade).toBe("Corner store that takes SNAP and uses Square");
    expect(profile.tradeKey).toBe("store");
    expect(profile.signals).toContain("snap");
    expect(profile.tools).toContain("Square");
    expect(profile.reach).toContain("Google");
    expect(profile.nicheAgents.map((agent) => agent.id)).toEqual(["niche:snap-stock-check"]);
  });

  it("detects the trade from free text", () => {
    expect(detectTradeKey("HVAC and plumbing")).toBe("home");
    expect(detectTradeKey("Pizza place")).toBe("restaurant");
    expect(detectTradeKey("Neighborhood bodega")).toBe("store");
    expect(detectTradeKey("Career coach")).toBe("coach");
    expect(detectTradeKey("Dental office")).toBe("any");
  });
});
