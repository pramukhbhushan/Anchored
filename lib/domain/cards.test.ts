import { describe, expect, it } from "vitest";
import { CORE_AGENTS } from "@/lib/domain/agents";
import { CARD_TEMPLATES, type CardBody, type CardSkill, draftFeed, simulateCard } from "@/lib/domain/cards";
import { CASE_STUDIES, caseStudyById, EXAMPLES, exampleProfile } from "@/lib/domain/cases";
import { checkSend, QUIET_HOURS_RULE } from "@/lib/domain/executor";
import { activeAgents, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, ChoiceMap, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the card feed: which cards the owner sees for a set of picks,
// who drafted each one, where triage sends forwarded email, the simulated
// event stream, and that every drafted card passes the send rules all year.

// Template variants to check: the standing card (0) and several simulated events.
const VARIANTS = [0, 1, 2, 3] as const;

const TEMPLATE_SKILLS = Object.keys(CARD_TEMPLATES) as CardSkill[];

const EVERY_BUSINESS: readonly BusinessProfile[] = [
  ...CASE_STUDIES,
  ...EXAMPLES.map((example) => exampleProfile(example.id)),
];

function caseStudy(id: string): BusinessProfile {
  const found = caseStudyById(id);
  if (found === undefined) throw new Error(`no case study \`${id}\``);
  return found;
}

/** The given picks, with every other workflow of the business skipped. */
function only(business: BusinessProfile, picks: ChoiceMap): ChoiceMap {
  const choices: Partial<Record<WorkflowId, Choice>> = {};
  for (const id of workflowIdsOf(business)) choices[id] = picks[id] ?? { path: "skip" };
  return choices;
}

describe("draftFeed", () => {
  const restaurant = caseStudy("restaurant");

  it("shows the allergy card only when the catering skill is chosen", () => {
    const allergy = { title: "Allergy question from Ana", channel: "locked", skill: "catering" };
    const withCatering = draftFeed(restaurant, only(restaurant, { catering: { path: "build", skills: ["catering"] } }));
    expect(withCatering).toContainEqual(
      expect.objectContaining({ ...allergy, agent: "frontdesk", key: "restaurant:locked:0" }),
    );
    const withoutCatering = draftFeed(
      restaurant,
      only(restaurant, { invoices: { path: "build", skills: ["pricewatch"] } }),
    );
    expect(withoutCatering).not.toContainEqual(expect.objectContaining(allergy));
  });

  it("uses the researched card and stamps the agent that runs the skill", () => {
    const hvac = caseStudy("hvac");
    const [first] = draftFeed(hvac, only(hvac, { calls: { path: "build", skills: ["callback"] } }));
    expect(first).toMatchObject({
      key: "hvac:callback",
      agent: "frontdesk",
      skill: "callback",
      title: "Missed call at 7:42 p.m. from (301) 555-0192",
    });
  });

  it("falls back to a template with the business's name, and ends with one triage card", () => {
    const dental = exampleProfile("dental");
    const feed = draftFeed(dental, only(dental, { calls: { path: "build", skills: ["callback"] } }));
    expect(feed.map((card) => card.key)).toEqual(["ex-dental:callback", "ex-dental:triage"]);
    expect(feed[0]?.body).toContain("this is Riverside Family Dental");
    expect(feed[1]).toMatchObject({ agent: "internal", skill: "triage", channel: "list" });
  });

  it("credits a niche skill's card to the niche agent", () => {
    const corner = exampleProfile("corner");
    const feed = draftFeed(corner, only(corner, { snap: { path: "build", skills: ["stockcheck"] } }));
    expect(feed[0]).toMatchObject({ skill: "stockcheck", agent: "niche:snap-stock-check" });
  });
});

describe("simulateCard", () => {
  const dental = exampleProfile("dental");
  const choices = only(dental, {
    calls: { path: "build", skills: ["callback"] },
    leads: { path: "build", skills: ["inquiry"] },
  });

  it("rotates through the chosen skills, one event at a time", () => {
    expect(simulateCard(dental, choices, 1)).toMatchObject({ skill: "callback", key: "ex-dental:sim:1" });
    expect(simulateCard(dental, choices, 2)).toMatchObject({ skill: "inquiry", key: "ex-dental:sim:2" });
    expect(simulateCard(dental, choices, 3)).toMatchObject({ skill: "callback", agent: "frontdesk" });
  });

  it("varies the details between events from the same skill", () => {
    const callsOnly = only(dental, { calls: { path: "build", skills: ["callback"] } });
    expect(simulateCard(dental, callsOnly, 1)?.title).not.toBe(simulateCard(dental, callsOnly, 2)?.title);
    // With two skills, events 1 and 3 both come from Callback.
    expect(simulateCard(dental, choices, 1)?.body).not.toBe(simulateCard(dental, choices, 3)?.body);
  });

  it("never repeats a standing card word for word", () => {
    const standing = new Set(draftFeed(dental, choices).map((card) => card.body));
    for (let n = 1; n <= 8; n += 1) {
      expect(standing.has(simulateCard(dental, choices, n)?.body ?? ""), `event ${n}`).toBe(false);
    }
  });

  it.each(TEMPLATE_SKILLS.filter((skill) => isCustomerFacing(CARD_TEMPLATES[skill](dental, 0))))(
    "gives %s simulated drafts that differ from its standing draft",
    (skill) => {
      const standing = CARD_TEMPLATES[skill](dental, 0).body;
      for (const variant of [1, 2, 3, 4]) expect(CARD_TEMPLATES[skill](dental, variant).body).not.toBe(standing);
    },
  );

  it("drafts nothing when no skill is chosen", () => {
    expect(simulateCard(dental, only(dental, {}), 1)).toBeNull();
  });

  it("counts events from 1", () => {
    expect(() => simulateCard(dental, choices, 0)).toThrow(RangeError);
  });
});

describe("triage", () => {
  const restaurant = caseStudy("restaurant");

  function triageCard(business: BusinessProfile, choices: ChoiceMap): CardBody {
    const card = draftFeed(business, choices).find((candidate) => candidate.skill === "triage");
    if (card === undefined) throw new Error(`no triage card for \`${business.id}\``);
    return card;
  }

  it("hands a supplier price list to the agent that checks prices when it is at work", () => {
    const card = triageCard(restaurant, only(restaurant, { invoices: { path: "build", skills: ["pricewatch"] } }));
    expect(card.action).toBe("Route to Bookkeeping and Invoicing");
    expect(card.body).toContain("Bookkeeping and Invoicing will compare it");
  });

  it("keeps the email for the owner when no agent here checks prices", () => {
    const hvac = caseStudy("hvac");
    const card = triageCard(hvac, {});
    expect(card.action).toBe("Add it to your list");
    expect(card.body).not.toContain("Bookkeeping");
  });

  it("keeps the email for the owner when the template isn't told who is at work", () => {
    expect(CARD_TEMPLATES.triage(restaurant, 1).action).toBe("Add it to your list");
  });

  const pickSets: readonly (readonly [string, (business: BusinessProfile) => ChoiceMap])[] = [
    ["default picks", () => ({})],
    ["every workflow skipped", (business) => only(business, {})],
  ];
  const cases = EVERY_BUSINESS.flatMap((business) =>
    pickSets.map(([label, picks]) => [`${business.id} with ${label}`, business, picks(business)] as const),
  );

  it.each(cases)("never routes to an agent that isn't at work: %s", (_label, business, choices) => {
    const card = triageCard(business, choices);
    const atWork = activeAgents(business, choices).map((agent) => agent.name);
    if (card.action !== "Add it to your list") expect(atWork).toContain(card.action.replace(/^Route to /, ""));
    for (const agent of Object.values(CORE_AGENTS)) {
      if (!atWork.includes(agent.name)) expect(card.body).not.toContain(agent.name);
    }
  });
});

describe("post cards", () => {
  const posts = (business: BusinessProfile): CardBody[] => VARIANTS.map((variant) => CARD_TEMPLATES.posts(business, variant));

  it("drafts Google listing posts only for a business that uses Google", () => {
    const corner = exampleProfile("corner");
    expect(corner.reach).not.toContain("Google");
    for (const card of posts(corner)) expect(`${card.title} ${card.body}`).not.toMatch(/google/i);
    expect(posts(exampleProfile("dental"))[0]?.title).toContain("Google");
    const listingOnly = { ...corner, tools: ["Google Business Profile"] };
    expect(posts(listingOnly)[0]?.title).toContain("Google");
  });

  it("never claims it read hours the post doesn't hold", () => {
    for (const business of [exampleProfile("corner"), exampleProfile("dental")]) {
      for (const card of posts(business)) expect(card.checks).not.toContain("Hours read from your profile");
    }
  });
});

describe("every drafted card", () => {
  // Researched cards and every template variant each business could draft. Locked cards never send by design.
  const drafts = EVERY_BUSINESS.flatMap((business) => [
    ...Object.entries(business.cards ?? {}).map(([skill, card]) => [`${business.id} researched ${skill}`, card] as const),
    ...TEMPLATE_SKILLS.flatMap((skill) =>
      VARIANTS.map((variant) => [`${business.id} ${skill} variant ${variant}`, CARD_TEMPLATES[skill](business, variant)] as const),
    ),
  ]);

  it("passes the send rules at 10 a.m. with consent: opt-out line, no placeholder, no allergy talk", () => {
    // 10 a.m. in New York on Nov 7, 2026.
    const daytime = { now: new Date("2026-11-07T15:00:00Z"), timeZone: "America/New_York", hasConsent: true };
    for (const [label, card] of drafts) {
      expect(checkSend({ ...card, agent: null, skill: null }, daytime), label).toEqual({ ok: true });
    }
  });

  it("makes no claim tied to a season or month", () => {
    const seasonal = /\b(winter|summer|spring|fall|autumn|holidays?|cold snap|heat wave|cooling|november|december)\b/i;
    for (const [label, card] of drafts) expect(`${card.title} ${card.body} ${card.reason}`, label).not.toMatch(seasonal);
  });

  it("states the send-hours rule instead of claiming the current time", () => {
    for (const [label, card] of drafts) {
      for (const check of card.checks.filter((text) => /\b[ap]\.m\./.test(text))) expect(check, label).toBe(QUIET_HOURS_RULE);
    }
  });

  it("names no weekday in a title or reason, which could contradict today's date", () => {
    const weekday = /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i;
    for (const [label, card] of drafts) expect(`${card.title} ${card.reason}`, label).not.toMatch(weekday);
  });

  it("asks HVAC callers about heat or AC, whatever the month", () => {
    expect(caseStudy("hvac").cards?.callback?.body).toContain("Is your heat or AC fully off, or running but not keeping up?");
  });
});

/** Whether a card goes to a customer, so a repeat would reach them twice. */
function isCustomerFacing(card: CardBody): boolean {
  return card.channel === "sms" || card.channel === "email";
}
