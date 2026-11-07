import { describe, expect, it } from "vitest";
import { morningBrief } from "@/lib/domain/brief";
import { caseStudyById } from "@/lib/domain/cases";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the morning brief lines the owner reads first.

function caseStudy(id: string): BusinessProfile {
  const found = caseStudyById(id);
  if (found === undefined) throw new Error(`no case study \`${id}\``);
  return found;
}

describe("morningBrief", () => {
  const hvac = caseStudy("hvac");

  it("leads with what waits, then what rides on it, new workflows and the stack cost", () => {
    const lines = morningBrief(hvac, {}, [
      { status: "pending", title: "Quote to the Okafors", stake: 11400 },
      { status: "pending", title: "Plan renewals", stake: 2800 },
      { status: "approved", title: "Missed call", stake: 500 },
    ]);
    expect(lines).toEqual([
      "2 cards wait for you. First up: Quote to the Okafors.",
      "$14,200 in quotes, invoices or orders rides on today's cards.",
      "New for you this week: Social posts and marketing.",
      "Your stack costs $29 a month.",
    ]);
  });

  it("says so when every card is decided, and names quote-only tools", () => {
    const lines = morningBrief(hvac, { leads: { path: "buy", toolId: "housecall" } }, [
      { status: "skipped", title: "Old card" },
    ]);
    expect(lines[0]).toBe("Nothing waits for you. Every card is decided.");
    expect(lines.at(-1)).toBe("Your stack costs $29 a month, plus Housecall Pro on quote.");
  });
});
