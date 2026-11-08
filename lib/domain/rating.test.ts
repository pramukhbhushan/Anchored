import { describe, expect, it } from "vitest";
import { exampleProfile, SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { toolById } from "@/lib/domain/catalog";
import { rateTool, usesSoftware } from "@/lib/domain/rating";
import type { Tool } from "@/lib/domain/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the seven-check rating: personalized checks and the weighted total.

function tool(id: string): Tool {
  const found = toolById(id);
  if (found === undefined) throw new Error(`no tool \`${id}\``);
  return found;
}

describe("rateTool", () => {
  const restaurant = SAMPLE_BUSINESS;

  it("rates Certus above Maple for the restaurant", () => {
    const certus = rateTool(tool("certus"), restaurant);
    const maple = rateTool(tool("maple"), restaurant);
    expect(certus.total).toBeGreaterThan(maple.total);
    expect([certus.total, maple.total]).toEqual([69, 47]);
  });

  it("marks connects as not met when the business doesn't use the tool's platform", () => {
    const rating = rateTool(tool("jobber-ai"), restaurant);
    expect(rating.checks.connects).toEqual(["no", "ours", "Needs Jobber, which you don't use"]);
  });

  it("marks connects as met when the business uses the tool's platform", () => {
    expect(rateTool(tool("jobber-ai"), hvacShop()).checks.connects[0]).toBe("met");
  });

  it("checks the languages the business serves besides English", () => {
    expect(rateTool(tool("certus"), restaurant).checks.langs).toEqual(["met", "page", "Names Spanish"]);
    expect(rateTool(tool("certus"), exampleProfile("corner")).checks.langs).toEqual([
      "no",
      "page",
      "Doesn't name Korean",
    ]);
    expect(rateTool(tool("maple"), restaurant).checks.langs).toEqual([
      "unknown",
      "none",
      "'Multilingual voice', languages not named",
    ]);
  });

  it("counts met and unknown checks out of seven", () => {
    const rating = rateTool(tool("certus"), restaurant);
    expect(rating.met).toBe(3);
    expect(rating.unknown).toBe(3);
  });
});

describe("usesSoftware", () => {
  it("matches names loosely in both directions", () => {
    expect(usesSoftware({ tools: ["QuickBooks Online"] }, "QuickBooks")).toBe(true);
    expect(usesSoftware({ tools: ["quickbooks"] }, "QuickBooks Online")).toBe(true);
    expect(usesSoftware({ tools: ["QuickBooks Online"] }, "Square")).toBe(false);
  });
});
