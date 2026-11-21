import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setLocation } from "@/test/next";
import { useShellLocation } from "./location";

// =============================================================================
// Module Overview
// =============================================================================
// `useShellLocation` under Workflows: one segment is an agent, two are an
// automation, so an agent id that is also a workflow id still reads right.

describe("agent shell locations", () => {
  it("identifies an agent at the one-segment Workflows depth", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "books"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "workflows", agent: "books" });
  });

  it("reads an automation page as Workflows with no agent open", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "books", "nudger"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "workflows" });
  });

  it("reads a niche agent id that Next already decoded", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "niche:stock-check"] });
    expect(renderHook(useShellLocation).result.current).toMatchObject({ agent: "niche:stock-check" });
  });

  it("decodes a percent-encoded niche agent id", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "niche%3Astock-check"] });
    expect(renderHook(useShellLocation).result.current).toMatchObject({ agent: "niche:stock-check" });
  });

  it("keeps a malformed segment as is rather than crashing the shell", () => {
    setLocation({ segments: ["b", "rosa", "workflows", "niche%broken"] });
    expect(renderHook(useShellLocation).result.current).toMatchObject({ agent: "niche%broken" });
  });

  it("does not treat a deeper segment in another section as an agent", () => {
    setLocation({ segments: ["b", "rosa", "connections", "books"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "connections" });
  });

  it("reads the Workflows map with no agent open", () => {
    setLocation({ segments: ["b", "rosa", "workflows"] });
    expect(renderHook(useShellLocation).result.current).toEqual({ page: "business", businessId: "rosa", section: "workflows" });
  });
});
