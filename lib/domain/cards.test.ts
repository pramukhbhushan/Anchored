import { describe, expect, it } from "vitest";
import { draftFeed, simulateCard } from "@/lib/domain/cards";
import { caseStudyById, exampleProfile } from "@/lib/domain/cases";
import { workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, ChoiceMap, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the card feed: which cards the owner sees for a set of picks,
// who drafted each one, and the simulated event stream.

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
  });

  it("drafts nothing when no skill is chosen", () => {
    expect(simulateCard(dental, only(dental, {}), 1)).toBeNull();
  });
});
