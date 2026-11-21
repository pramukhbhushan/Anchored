import { describe, expect, it } from "vitest";
import { SECTIONS, agentHref, businessHref, cardAnchor } from "./routes";

// =============================================================================
// Module Overview
// =============================================================================
// The URL builders: an agent's workspace sits one segment under Workflows,
// business and agent ids are percent-encoded, and an approvals anchor is built
// from the card's key alone.

describe("agent workspace routes", () => {
  it("puts an agent's workspace one segment under Workflows", () => {
    expect(agentHref("restaurant", "books")).toBe("/app/b/restaurant/workflows/books");
    expect(businessHref("restaurant", "workflows")).toBe("/app/b/restaurant/workflows");
  });

  it("encodes business and niche agent identifiers as individual segments", () => {
    expect(agentHref("Sam / shop", "niche:stock check")).toBe("/app/b/Sam%20%2F%20shop/workflows/niche%3Astock%20check");
  });

  it("builds an approvals anchor from the card key alone", () => {
    const key = "restaurant:inquiry:message/7";
    expect(`${businessHref("restaurant", "approvals")}#${cardAnchor(key)}`).toBe("/app/b/restaurant/approvals#card-restaurant-inquiry-message-7");
  });

  it("lists the business pages in sidebar order", () => {
    expect(SECTIONS.map((entry) => entry.label)).toEqual(["Overview", "Chat", "Workflows", "Automations", "Tools", "Approvals", "Connections", "Stack", "Profile"]);
  });
});
