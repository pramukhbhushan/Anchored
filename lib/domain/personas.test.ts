import { describe, expect, it } from "vitest";
import { draftFeed } from "@/lib/domain/cards";
import { exampleProfile, SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { checkSend } from "@/lib/domain/executor";
import { activeAgents, chosenTools, resolveChoices, stackCost } from "@/lib/domain/paths";
import type { BusinessProfile, SkillId, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The three businesses the team researched, run through the platform the way a
// visitor meets them: the restaurant as the example business, and the HVAC
// shop and the career coach as the landing page's first two mapper examples.
// Each one gets a plan, Anchored's picks, agents, drafted cards that pass the
// send rules, and a monthly bill, and each plan carries its report's headline
// finding. The research lives in `docs/research/`.

/** Everything a visitor sees of one business with Anchored's default picks. */
function runThrough(business: BusinessProfile) {
  const choices = resolveChoices(business, {});
  const feed = draftFeed(business, choices);
  return {
    choices,
    skills: feed.map((card) => card.skill),
    feed,
    agents: activeAgents(business, choices).map((agent) => agent.name),
    tools: chosenTools(business, choices).map((chosen) => chosen.tool.name),
    cost: stackCost(business, choices),
  };
}

/** The workflows whose fit is highest, the ones a plan leads with. */
function bestFits(business: BusinessProfile): WorkflowId[] {
  const fits = Object.entries(business.workflows).map(([id, plan]) => [id as WorkflowId, plan?.fit ?? 0] as const);
  const top = Math.max(...fits.map(([, fit]) => fit));
  return fits.filter(([, fit]) => fit === top).map(([id]) => id);
}

const PERSONAS = [
  ["restaurant", SAMPLE_BUSINESS],
  ["HVAC", exampleProfile("hvac")],
  ["coaching", exampleProfile("coach")],
] as const;

describe("each research persona runs through the platform", () => {
  it.each(PERSONAS)("the %s business gets a plan, agents, drafts that pass the send rules and a bill", (_trade, business) => {
    const run = runThrough(business);
    // 10 a.m. in New York, texting a customer with a consent record.
    const daytime = { now: new Date("2026-11-09T15:00:00Z"), timeZone: "America/New_York", hasConsent: true };

    expect(Object.keys(business.workflows).length).toBeGreaterThanOrEqual(5);
    expect(run.agents.length).toBeGreaterThan(0);
    expect(run.feed.length).toBeGreaterThan(0);
    for (const card of run.feed.filter((draft) => draft.channel !== "locked")) {
      expect(checkSend(card, daytime), card.title).toEqual({ ok: true });
    }
    expect(run.cost.total).toBeGreaterThan(0);
  });

  it("restaurant: turns on what the restaurant already pays for and watches supplier prices", () => {
    const run = runThrough(SAMPLE_BUSINESS);

    expect(run.choices.noshows).toMatchObject({ path: "turnon" });
    expect(run.tools).toContain("OpenTable");
    expect(run.skills).toEqual(expect.arrayContaining<SkillId>(["pricewatch", "catering"]));
    // The allergy question stays locked for the owner to answer.
    expect(run.feed.find((card) => card.channel === "locked")?.title).toMatch(/allergy/i);
  });

  it("HVAC: leads with missed calls and quote follow-up, and turns a visit's spoken price into a follow-up", () => {
    const hvac = exampleProfile("hvac");
    const run = runThrough(hvac);

    expect(bestFits(hvac)).toEqual(expect.arrayContaining<WorkflowId>(["calls", "quotes"]));
    expect(run.skills).toEqual(expect.arrayContaining<SkillId>(["callback", "closer", "debrief"]));
    expect(run.choices.books).toMatchObject({ path: "turnon" });
  });

  it("coaching: chases 'let me think about it' after a discovery call and turns on the booking reminders Calendly has", () => {
    const coach = exampleProfile("coach");
    const run = runThrough(coach);

    expect(bestFits(coach)).toContain("leads");
    expect(run.skills).toEqual(expect.arrayContaining<SkillId>(["inquiry", "callfollow"]));
    expect(run.choices.noshows).toMatchObject({ path: "turnon" });
    expect(run.tools).toContain("Calendly");
    // A solo coach works from booked calls and messages, not a phone line.
    expect(run.choices.calls).toMatchObject({ path: "skip" });
  });
});
