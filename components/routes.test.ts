import { describe, expect, it } from "vitest";
import { SECTIONS, agentHref, businessHref, cardAnchor } from "./routes";

// =============================================================================
// Module Overview
// =============================================================================
// Protects the existing product URLs as agent workspaces are added underneath
// Workflows. Dynamic business and agent identifiers remain encoded, and the
// approval anchors keep their established meaning.

describe("agent workspace routes", () => {
  it("puts an agent's workspace one segment under Workflows", () => {
    expect(agentHref("restaurant", "books")).toBe("/app/b/restaurant/workflows/books");
    expect(businessHref("restaurant", "workflows")).toBe("/app/b/restaurant/workflows");
  });

  it("encodes business and niche agent identifiers as individual segments", () => {
    expect(agentHref("Sam / shop", "niche:stock check")).toBe("/app/b/Sam%20%2F%20shop/workflows/niche%3Astock%20check");
  });

  it("keeps one approvals anchor stable as a card is materialized", () => {
    const key = "restaurant:inquiry:message/7";
    expect(`${businessHref("restaurant", "approvals")}#${cardAnchor(key)}`).toBe("/app/b/restaurant/approvals#card-restaurant-inquiry-message-7");
  });

  it("retains the existing top-level sections in their order", () => {
    expect(SECTIONS.map((entry) => entry.label)).toEqual(["Overview", "Chat", "Workflows", "Automations", "Tools", "Approvals", "Connections", "Stack", "Profile"]);
  });
});
