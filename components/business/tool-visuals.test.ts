import { describe, expect, it } from "vitest";
import { fitBand, monogram, nameHue, priceChip } from "@/components/business/tool-visuals";

// =============================================================================
// Module Overview
// =============================================================================
// The short forms the Tools page draws: a score's band, a tool's letters and
// color, and its price in a few characters.

describe("fitBand", () => {
  it("splits scores into good, fair and weak", () => {
    expect([69, 60, 59, 45, 44, 0].map(fitBand)).toEqual(["good", "good", "fair", "fair", "weak", "weak"]);
  });
});

describe("monogram", () => {
  it("takes the first letters of the first two words", () => {
    expect(monogram("QuickBooks Online")).toBe("QO");
    expect(monogram("Certus")).toBe("C");
    expect(monogram("Done-for-you AI follow-up")).toBe("DA");
    expect(monogram("7shifts")).toBe("7");
  });
});

describe("nameHue", () => {
  it("gives the same name the same hue, in range", () => {
    expect(nameHue("Jobber")).toBe(nameHue("Jobber"));
    expect(nameHue("Jobber")).toBeGreaterThanOrEqual(0);
    expect(nameHue("Jobber")).toBeLessThan(360);
  });
});

describe("priceChip", () => {
  it("says a monthly price in a few characters", () => {
    expect(priceChip({ monthly: 250 })).toBe("$250/mo");
    expect(priceChip({ monthly: 59.95 })).toBe("$59.95/mo");
    expect(priceChip({ monthly: 2.5, perUser: true })).toBe("$2.50/user/mo");
    expect(priceChip({ monthly: 1200 })).toBe("$1,200/mo");
  });

  it("says when a tool is free to start or only quoted", () => {
    expect(priceChip({ monthly: 0 })).toBe("Free to start");
    expect(priceChip({ monthly: null })).toBe("On quote");
  });
});
