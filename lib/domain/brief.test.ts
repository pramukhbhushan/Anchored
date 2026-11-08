import { describe, expect, it } from "vitest";
import { morningBrief } from "@/lib/domain/brief";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the morning brief lines the owner reads first. Dollars come only
// from cards the owner's own events drafted, or from the example's research.

describe("morningBrief", () => {
  const hvac = hvacShop();

  it("leads with what waits, then what rides on it, new workflows and the stack cost", () => {
    const lines = morningBrief(hvac, {}, [
      { key: "hvac:event:a", status: "pending", title: "Quote to the Okafors", stake: 11400 },
      { key: "hvac:event:b", status: "pending", title: "Plan renewals", stake: 2800 },
      { key: "hvac:event:c", status: "approved", title: "Missed call", stake: 500 },
    ]);
    expect(lines).toEqual([
      "2 cards wait for you. First up: Quote to the Okafors.",
      "$14,200 in quotes, invoices or orders rides on today's cards.",
      "New for you: Social posts and marketing.",
      "Your stack costs $29 a month.",
    ]);
  });

  it("puts no dollar figure on an owner's sample drafts", () => {
    const lines = morningBrief(hvac, {}, [{ key: "hvac:nudger", status: "pending", title: "Invoice 1042 is 9 days late", stake: 240 }]);
    expect(lines.join(" ")).not.toContain("rides on");
  });

  it("counts the example's researched dollars", () => {
    const lines = morningBrief(SAMPLE_BUSINESS, {}, [{ key: "restaurant:catering", status: "pending", title: "Party of 40", stake: 1200 }]);
    expect(lines).toContain("$1,200 in quotes, invoices or orders rides on today's cards.");
  });

  it("says so when every card is decided, and names quote-only tools", () => {
    const lines = morningBrief(hvac, { leads: { path: "buy", toolId: "housecall" } }, [{ key: "hvac:event:d", status: "skipped", title: "Old card" }]);
    expect(lines[0]).toBe("Nothing waits for you. Every card is decided.");
    expect(lines.at(-1)).toBe("Your stack costs $29 a month, plus Housecall Pro on quote.");
  });
});
