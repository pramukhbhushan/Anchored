import { describe, expect, it } from "vitest";
import { CORE_AGENTS, SKILLS } from "@/lib/domain/agents";
import { CARD_TEMPLATES, type CardBody, type CardSkill, draftFeed, simulateCard } from "@/lib/domain/cards";
import { EXAMPLES, exampleProfile, SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { checkSend, QUIET_HOURS_RULE } from "@/lib/domain/executor";
import { activeAgents, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, ChoiceMap, TradeKey, WorkflowId } from "@/lib/domain/types";
import { careerCoach, hvacShop } from "@/test/trades";

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
  SAMPLE_BUSINESS,
  hvacShop(),
  careerCoach(),
  ...EXAMPLES.map((example) => exampleProfile(example.id)),
];

/** The given picks, with every other workflow of the business skipped. */
function only(business: BusinessProfile, picks: ChoiceMap): ChoiceMap {
  const choices: Partial<Record<WorkflowId, Choice>> = {};
  for (const id of workflowIdsOf(business)) choices[id] = picks[id] ?? { path: "skip" };
  return choices;
}

describe("draftFeed", () => {
  const restaurant = SAMPLE_BUSINESS;

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
    const [first] = draftFeed(restaurant, only(restaurant, { catering: { path: "build", skills: ["catering"] } }));
    expect(first).toMatchObject({
      key: "restaurant:catering",
      agent: "frontdesk",
      skill: "catering",
      title: "Party of 40 in three weeks, from your catering form",
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
  const restaurant = SAMPLE_BUSINESS;

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
    const card = triageCard(restaurant, only(restaurant, {}));
    expect(card.title).toContain("price list");
    expect(card.action).toBe("Add it to your list");
    expect(card.body).not.toContain("Bookkeeping");
  });

  it("forwards a customer's question, not a price list, for a business that buys from no suppliers", () => {
    const coach = exampleProfile("coach");
    expect(coach.signals).not.toContain("suppliers");
    const card = triageCard(coach, {});
    expect(card.title).not.toContain("supplier");
    expect(card.title).toContain("question");
    expect(card.action).toBe("Route to Front Desk");
    expect(triageCard(coach, only(coach, {})).action).toBe("Add it to your list");
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

describe("templates for work no connected source feeds", () => {
  // Invoices, plan lists, past customers, licenses, voice notes and shelf counts can't reach Anchored yet,
  // so any count, price, percent or invoice number on these cards would be made up.
  const UNFED: readonly CardSkill[] = ["debrief", "reactivator", "keeper", "nudger", "pricewatch", "license", "stockcheck"];
  const FIGURE = /\$\d|\d+%|\b\d+ (?:past )?(?:customers|plans|varieties|days)\b|\binvoice \d+|\d+ of \d+/i;

  it.each(UNFED.flatMap((skill) => VARIANTS.map((v) => [skill, v] as const)))("%s, variant %i, states no made-up figure", (skill, variant) => {
    const card = CARD_TEMPLATES[skill](hvacShop(), variant);
    expect(`${card.title} ${card.body} ${card.action} ${card.to ?? ""}`).not.toMatch(FIGURE);
    expect(card.stake).toBeUndefined();
  });
});

describe("callback cards", () => {
  it("offer two open times, as the Callback skill promises", () => {
    expect(SKILLS.callback.does).toContain("Drafts one text with two open times");
    const dental = exampleProfile("dental");
    for (const variant of VARIANTS) {
      expect(CARD_TEMPLATES.callback(dental, variant).body, `variant ${variant}`).toMatch(/\d{1,2}(?::\d\d)? [ap]\.m\. or \d{1,2}(?::\d\d)? [ap]\.m\./);
    }
  });
});

describe("inquiry cards", () => {
  const title = (reach: readonly string[]) => CARD_TEMPLATES.inquiry({ ...hvacShop(), reach }, 0).title;

  it("name the website only for a business that said it has a website form", () => {
    expect(title(["Phone calls", "Website form"])).toMatch(/^New inquiry from your website: \p{Lu}\p{L}+$/u);
    expect(title(["Phone calls", "Walk-ins"])).toMatch(/^New inquiry from \p{Lu}\p{L}+$/u);
  });

  it("name the first written channel the owner has", () => {
    expect(title(["Instagram or Facebook", "Email"])).toMatch(/^New inquiry on social media: /);
    expect(title(["Email"])).toMatch(/^New inquiry by email: /);
  });

  it("offer meeting times only to a business that keeps a calendar tool", () => {
    const shop = { ...hvacShop(), tools: ["QuickBooks Online"] };
    const noCalendar = CARD_TEMPLATES.inquiry(shop, 0);
    expect(noCalendar.body).not.toMatch(/\d/);
    expect(noCalendar.checks).not.toContain("Times match your calendar");
    const withCalendar = CARD_TEMPLATES.inquiry({ ...shop, tools: ["Calendly"] }, 0);
    expect(withCalendar.body).toMatch(/\d{1,2} [ap]\.m\./);
    expect(withCalendar.checks).toContain("Times match your calendar");
  });
});

describe("fallback drafts", () => {
  const TRADES: readonly TradeKey[] = ["home", "restaurant", "store", "coach", "any"];
  const asTrade = (tradeKey: TradeKey, id = "b_same"): BusinessProfile => ({ ...hvacShop(), id, tradeKey });

  it("pick contact names from the business id, so two businesses rarely share one", () => {
    const names = Array.from({ length: 12 }, (_, i) => CARD_TEMPLATES.inquiry(asTrade("home", `b_${i}`), 0).to);
    expect(new Set(names).size).toBeGreaterThanOrEqual(10);
    expect(CARD_TEMPLATES.inquiry(asTrade("home", "b_3"), 0).to).toBe(names[3]);
  });

  it("give one person one name across a card's title, body and recipient", () => {
    const card = CARD_TEMPLATES.closer(asTrade("home", "b_family"), 0);
    const [first, last] = (card.to ?? "").split(" ");
    expect(card.title).toContain(last);
    expect(card.body).toContain(`Hi ${first}`);
  });

  it("word the same skill differently for each trade", () => {
    for (const skill of ["inquiry", "showup", "reviewer", "reviewdrafter"] as const) {
      const texts = TRADES.map((trade) => {
        const card = CARD_TEMPLATES[skill](asTrade(trade), 0);
        return `${card.title} ${card.body}`;
      });
      expect(new Set(texts).size, skill).toBe(TRADES.length);
    }
  });

  it("word a forwarded customer question for the trade", () => {
    const titles = TRADES.map((trade) => CARD_TEMPLATES.triage({ ...asTrade(trade), signals: [] }, 0).title);
    expect(new Set(titles).size).toBe(TRADES.length);
  });

  it("are marked as examples on an owner's business, and the example business keeps its researched cards unmarked", () => {
    const own = draftFeed(hvacShop(), {});
    expect(own.length).toBeGreaterThan(1);
    for (const card of own) expect(card.example, card.key).toBe(true);
    for (const card of draftFeed(SAMPLE_BUSINESS, {})) expect(card.example, card.key).toBeUndefined();
  });

  it("never mark a simulated event as an example", () => {
    expect(simulateCard(hvacShop(), {}, 1)?.example).toBeUndefined();
  });
});

describe("post cards", () => {
  const posts =(business: BusinessProfile): CardBody[] => VARIANTS.map((variant) => CARD_TEMPLATES.posts(business, variant));

  it("never offers a field trade bookings or a vague look at our work", () => {
    for (const card of posts(exampleProfile("hvac"))) expect(card.body).not.toMatch(/new bookings|what we've been working on/i);
    for (const card of posts(exampleProfile("corner"))) expect(card.body).not.toMatch(/what we've been working on/i);
  });

  it("drafts Google listing posts only for a business that uses Google", () => {
    const corner = exampleProfile("corner");
    expect(corner.reach).not.toContain("Google");
    for (const card of posts(corner)) expect(`${card.title} ${card.body}`).not.toMatch(/google/i);
    expect(posts(exampleProfile("dental"))[0]?.title).toContain("Google");
    const listingOnly = { ...corner, tools: ["Google Business Profile"] };
    expect(posts(listingOnly)[0]?.title).toContain("Google");
  });

  it("invites customers to stop by only when they walk in", () => {
    const stopBy = /stop by|came by|say hi/i;
    for (const card of posts(exampleProfile("coach"))) expect(card.body).not.toMatch(stopBy);
    for (const card of posts(exampleProfile("hvac"))) expect(card.body).not.toMatch(stopBy);
    expect(posts(exampleProfile("corner")).some((card) => stopBy.test(card.body))).toBe(true);
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
});

/** Whether a card goes to a customer, so a repeat would reach them twice. */
function isCustomerFacing(card: CardBody): boolean {
  return card.channel === "sms" || card.channel === "email";
}
