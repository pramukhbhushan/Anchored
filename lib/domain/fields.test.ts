import { describe, expect, it } from "vitest";
import { CORE_AGENTS } from "@/lib/domain/agents";
import { FIELD_KEYS, FIELDS, fieldsFor, isFilled } from "@/lib/domain/fields";
import type { CoreAgentId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The field registry's promises: every core agent has at least one must field,
// conditional fields drop out where they don't apply, format examples never
// read as a suggested value, and `isFilled` treats blanks as missing.

const AGENTS = Object.keys(CORE_AGENTS) as CoreAgentId[];

describe("FIELDS", () => {
  it("keys each entry by its own key", () => {
    for (const key of FIELD_KEYS) expect(FIELDS[key].key).toBe(key);
  });

  it("gives every core agent at least one must field", () => {
    for (const agent of AGENTS) expect(fieldsFor(agent, "must", { details: { pricingMethod: "quote" } }).length).toBeGreaterThan(0);
  });

  it("names only real core agents", () => {
    for (const key of FIELD_KEYS) {
      for (const agent of Object.keys(FIELDS[key].needs)) expect(AGENTS).toContain(agent);
    }
  });

  it("writes owner copy with no dashes", () => {
    for (const key of FIELD_KEYS) {
      const { label, ask } = FIELDS[key];
      for (const text of [label, ask.prompt, ask.example]) expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("fieldsFor", () => {
  it("asks for price drivers only from a business that quotes", () => {
    expect(fieldsFor("followup", "must", { details: { pricingMethod: "quote" } })).toContain("priceDrivers");
    expect(fieldsFor("followup", "must", { details: { pricingMethod: "menu" } })).not.toContain("priceDrivers");
    expect(fieldsFor("followup", "must", {})).not.toContain("priceDrivers");
  });
});

describe("isFilled", () => {
  it("treats blank strings, empty lists and missing values as missing", () => {
    expect(isFilled(undefined, "hours")).toBe(false);
    expect(isFilled({ hours: "  " }, "hours")).toBe(false);
    expect(isFilled({ prices: [] }, "prices")).toBe(false);
    expect(isFilled({ minimumCharge: Number.NaN }, "minimumCharge")).toBe(false);
  });

  it("accepts a value of each shape", () => {
    expect(isFilled({ hours: "9 to 5" }, "hours")).toBe(true);
    expect(isFilled({ minimumCharge: 0 }, "minimumCharge")).toBe(true);
    expect(isFilled({ prices: [{ item: "Tune-up", low: 129 }] }, "prices")).toBe(true);
    expect(isFilled({ vocabulary: { customer: "guest", workUnit: "order", priceTerm: "price", bookingTerm: "reservation" } }, "vocabulary")).toBe(true);
  });
});
