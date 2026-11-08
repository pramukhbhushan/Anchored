import { describe, expect, it } from "vitest";
import { crewDecisions, turnOnChoice, withCrewDecisions } from "@/lib/domain/crew";
import { profileFromAnswers } from "@/lib/domain/engine";

// =============================================================================
// Module Overview
// =============================================================================
// Crew decision tests: every core agent gets a sourced reason, rules decide
// which ones start on, and every off agent with planned work can be turned on.

const SHOP = profileFromAnswers({
  name: "Apex Heating, Bowie",
  kind: "HVAC contractor",
  what: "Repairs and replacement quotes for homeowners",
  week: "Returning missed calls, chasing quotes and writing posts",
  voice: "Thanks for calling Apex.",
  reach: ["Phone calls"],
  tools: [],
  signals: ["quotes"],
  languages: ["English"],
});

describe("crewDecisions", () => {
  it("returns every core agent with an owner-provided trigger", () => {
    const decisions = crewDecisions(SHOP);

    expect(decisions.map((decision) => decision.agent)).toEqual(["frontdesk", "followup", "books", "content", "internal"]);
    expect(decisions.every((decision) => decision.reason !== "" && decision.quote !== undefined && decision.quote !== "")).toBe(true);
    expect(decisions.find((decision) => decision.agent === "frontdesk")?.on).toBe(true);
    expect(decisions.find((decision) => decision.agent === "internal")?.on).toBe(true);
  });

  it("adds the decisions without changing the plan", () => {
    const enriched = withCrewDecisions(SHOP);

    expect(enriched.workflows).toBe(SHOP.workflows);
    expect(enriched.crew).toHaveLength(5);
  });
});

describe("turnOnChoice", () => {
  it("returns a real build path for an agent", () => {
    expect(turnOnChoice(SHOP, "content")).toEqual({ workflow: "social" });
  });
});
