import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setLocation } from "@/test/next";
import { useShellLocation } from "./location";

// =============================================================================
// Module Overview
// =============================================================================
// Distinguishes the agent landing URL from the existing automation detail
// URL at a different depth. The sidebar can identify one current destination
// without treating an agent id that is also a workflow id as an automation.

describe("agent shell locations", () => {
  it("identifies an agent at the one-segment Workflows depth", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "books"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "workflows", agent: "books" });
  });

  it("reads the agent from the one segment under Workflows and ignores anything deeper", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "books", "nudger"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "workflows", agent: "books" });
  });

  it("retains a niche agent identity supplied by Next's decoded segments", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "niche:stock-check"] });
    expect(renderHook(useShellLocation).result.current).toMatchObject({ agent: "niche:stock-check" });
  });

  it("decodes an encoded niche agent segment for matching the navigation identity", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "niche%3Astock-check"] });
    expect(renderHook(useShellLocation).result.current).toMatchObject({ agent: "niche:stock-check" });
  });

  it("retains a malformed route token rather than crashing the shell", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "niche%broken"] });
    expect(renderHook(useShellLocation).result.current).toMatchObject({ agent: "niche%broken" });
  });

  it("does not treat a deeper segment in another section as an agent", () => {
    setLocation({ segments: ["b", "rosa", "connections", "books"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "connections" });
  });

  it("retains the Workflows map location without an agent or automation", () => {
    setLocation({ segments: ["b", "rosa", "workflows"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "workflows" });
  });
});
