import { describe, expect, it } from "vitest";
import { SKILLS } from "@/lib/domain/agents";
import { ACTIVE_AGENT_FIXTURES, CARD_FIXTURES, FOLLOW_UP_FIXTURE, FRONT_DESK_FIXTURE, NICHE_AGENT_FIXTURE, PENDING_CARD_FIXTURE } from "./fixtures";
import { cardsForAgent, normalizeAgentId, presentAgents } from "./view-model";

// =============================================================================
// Module Overview
// =============================================================================
// Checks the owner's agent labels and activity during the Customer merge.
// Presentation must not activate unchosen work, duplicate a draft, lose a
// niche agent, or mistake a skipped or replaced draft for an approval.

describe("agent presentation", () => {
  it.each(["frontdesk", "followup", "customer"])("shows %s as the same Customer identity", (id) => {
    expect(normalizeAgentId(id)).toBe("customer");
  });

  it("retains other core and niche identities, and refuses unknown identities", () => {
    for (const id of ["books", "content", "internal", "niche:stock-check"]) expect(normalizeAgentId(id)).toBe(id);
    for (const id of [null, "", "other", "niche:", "niche: "]) expect(normalizeAgentId(id)).toBeNull();
  });

  it("combines the two active Customer agents and their enabled skills once", () => {
    const agents = presentAgents([FRONT_DESK_FIXTURE, FOLLOW_UP_FIXTURE]);
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      id: "customer",
      name: "Customer",
      job: "Answers first contact. Follows up on quotes",
      skills: ["inquiry", "showup", "closer"],
      niche: false,
      approval: "every-card",
    });
    expect(agents[0]?.never).toEqual([...new Set((["inquiry", "showup", "closer"] as const).flatMap((skill) => SKILLS[skill].never))]);
  });

  it("does not invent inactive agents or extra skills when only one legacy agent is active", () => {
    expect(presentAgents([])).toEqual([]);
    expect(presentAgents([FOLLOW_UP_FIXTURE])).toMatchObject([{ id: "customer", skills: ["closer", "inquiry"] }]);
    expect(presentAgents([FOLLOW_UP_FIXTURE])).toHaveLength(1);
  });

  it("preserves an active niche agent and the other domain names", () => {
    const agents = presentAgents(ACTIVE_AGENT_FIXTURES);
    expect(agents.map((agent) => agent.id)).toEqual(["customer", "books", "content", "internal", "niche:stock-check"]);
    expect(agents.find((agent) => agent.id === NICHE_AGENT_FIXTURE.id)).toMatchObject(NICHE_AGENT_FIXTURE);
    expect(agents.find((agent) => agent.id === "books")?.name).toBe("Bookkeeping");
  });

  it("leaves the supplied active-agent records unchanged", () => {
    const before = structuredClone(ACTIVE_AGENT_FIXTURES);
    presentAgents(ACTIVE_AGENT_FIXTURES);
    expect(ACTIVE_AGENT_FIXTURES).toEqual(before);
  });
});

describe("agent activity", () => {
  it("combines old Customer ownership and shows each stable card key once", () => {
    const cards = cardsForAgent(CARD_FIXTURES, "customer");
    expect(cards.map((card) => card.key)).toEqual(["example-business:inquiry", "example-business:closer", "example-business:skipped", "example-business:replaced"]);
    expect(cards[0]).toBe(PENDING_CARD_FIXTURE);
    expect(cards.map((card) => card.status)).toEqual(["pending", "approved", "skipped", "superseded"]);
  });

  it("keeps niche activity separate and omits agentless owner notes", () => {
    expect(cardsForAgent(CARD_FIXTURES, "niche:stock-check").map((card) => card.key)).toEqual(["example-business:stock"]);
    expect(cardsForAgent(CARD_FIXTURES, "books")).toEqual([]);
  });

  it("does not change the supplied cards", () => {
    const before = structuredClone(CARD_FIXTURES);
    cardsForAgent(CARD_FIXTURES, "customer");
    expect(CARD_FIXTURES).toEqual(before);
  });
});
