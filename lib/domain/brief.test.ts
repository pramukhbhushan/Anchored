import { describe, expect, it } from "vitest";
import { morningBrief } from "@/lib/domain/brief";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the morning brief lines the owner reads first.

describe("morningBrief", () => {
  const hvac = hvacShop();

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
