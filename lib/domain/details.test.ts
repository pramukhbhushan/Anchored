import { describe, expect, it } from "vitest";
import {
  candidateFor,
  candidatesFromSales,
  confirmAll,
  conflictLine,
  detailText,
  gapsFor,
  looksLikeSessionNotes,
  mergeCandidate,
  mergeCandidates,
  needsOwner,
  NO_DETAILS,
  parseDetail,
  parsePrices,
  readinessFor,
  vocabularyGuess,
  type DetailCandidate,
} from "@/lib/domain/details";

// =============================================================================
// Module Overview
// =============================================================================
// What the details rules promise: the owner's words beat a website, a website
// beats reviews, and a disagreement is kept for the owner instead of dropped;
// values are read only from words that state them; readiness counts must fields.

const fromWebsite: DetailCandidate = { key: "hours", value: "Mon to Fri 9 to 6", sourceType: "website", quote: "Open 9 to 6 weekdays", confidence: "high" };
const fromOwner: DetailCandidate = { key: "hours", value: "Mon to Fri 9 to 8", sourceType: "owner", quote: "we close at 8", confidence: "high" };

describe("mergeCandidate", () => {
  it("lets the owner's words win over the website, and keeps the website's value as a conflict", () => {
    const state = mergeCandidates(NO_DETAILS, [fromWebsite, fromOwner]);

    expect(state.details.hours).toBe("Mon to Fri 9 to 8");
    expect(state.evidence.hours?.sourceType).toBe("owner");
    expect(state.evidence.hours?.conflicts).toEqual([{ value: "Mon to Fri 9 to 6", sourceType: "website", quote: "Open 9 to 6 weekdays" }]);
    expect(conflictLine("hours", state)).toBe("Your website says Mon to Fri 9 to 6. You said Mon to Fri 9 to 8. Which is right?");
  });

  it("keeps the owner's value when a weaker source arrives later, and still records the disagreement", () => {
    const state = mergeCandidates(NO_DETAILS, [fromOwner, fromWebsite]);

    expect(state.details.hours).toBe("Mon to Fri 9 to 8");
    expect(state.evidence.hours?.conflicts?.[0]?.sourceType).toBe("website");
  });

  it("treats a source changing its own answer as a correction, not a conflict", () => {
    const state = mergeCandidates(NO_DETAILS, [fromOwner, { ...fromOwner, value: "Mon to Sat 9 to 8", quote: "Saturdays too" }]);

    expect(state.details.hours).toBe("Mon to Sat 9 to 8");
    expect(state.evidence.hours?.conflicts).toBeUndefined();
  });

  it("ranks reviews below the listing", () => {
    const listing: DetailCandidate = { key: "hours", value: "9 to 5", sourceType: "listing", quote: "9 to 5", confidence: "medium" };
    const reviews: DetailCandidate = { key: "hours", value: "8 to 5", sourceType: "reviews", quote: "open early at 8", confidence: "high" };

    expect(mergeCandidates(NO_DETAILS, [reviews, listing]).details.hours).toBe("9 to 5");
  });

  it("keeps the stronger evidence when two sources agree", () => {
    const state = mergeCandidate(mergeCandidate(NO_DETAILS, { ...fromWebsite, value: "9 to 8" }), { ...fromOwner, value: "9 to 8" });

    expect(state.evidence.hours?.sourceType).toBe("owner");
    expect(state.evidence.hours?.conflicts).toBeUndefined();
  });
});

describe("confirmAll and needsOwner", () => {
  it("asks the owner about a missing field or an unconfirmed low guess, and not once they confirm", () => {
    const guess = vocabularyGuess("home", "HVAC contractor");
    if (guess === null) throw new Error("test setup: home has usual words");
    const state = mergeCandidate(NO_DETAILS, guess);

    expect(needsOwner(NO_DETAILS, "vocabulary")).toBe(true);
    expect(needsOwner(state, "vocabulary")).toBe(true);
    expect(needsOwner(confirmAll(state), "vocabulary")).toBe(false);
  });

  it("offers no guess for a kind of business with no usual words", () => {
    expect(vocabularyGuess("any", "Dental office")).toBeNull();
    // A bakery takes orders; only a sit-down restaurant has guests and reservations.
    expect(vocabularyGuess("restaurant", "Bakery")?.value).toMatchObject({ customer: "customer", bookingTerm: "order" });
    expect(vocabularyGuess("restaurant", "Family restaurant")?.value).toMatchObject({ customer: "guest", bookingTerm: "reservation" });
  });
});

describe("parseDetail", () => {
  it("reads prices, with ranges and item names", () => {
    expect(parsePrices("Basic $40, Full $90 to $120")).toEqual([
      { item: "Basic", low: 40 },
      { item: "Full", low: 90, high: 120 },
    ]);
    expect(parsePrices("A tune-up is $129 and installs run $1,200-$1,800")).toEqual([
      { item: "tune-up", low: 129 },
      { item: "installs", low: 1200, high: 1800 },
    ]);
  });

  it("finds no price in words with no dollar amount", () => {
    expect(parseDetail("prices", "It depends on the job")).toBeUndefined();
    expect(candidatesFromSales("We fix furnaces and AC for homeowners", "owner")).toEqual([]);
  });

  it("reads the owner's words for customers and work", () => {
    expect(parseDetail("vocabulary", "Homeowners, and a service call")).toEqual({ customer: "homeowner", workUnit: "service call", priceTerm: "price", bookingTerm: "booking" });
    expect(parseDetail("vocabulary", "guests / order / price / reservation")).toEqual({ customer: "guest", workUnit: "order", priceTerm: "price", bookingTerm: "reservation" });
  });

  it("reads how a business charges, a minimum, lists and a review link", () => {
    expect(parseDetail("pricingMethod", "Every job gets a quote")).toBe("quote");
    expect(parseDetail("pricingMethod", "We charge by the hour")).toBe("hourly");
    expect(parseDetail("minimumCharge", "Our minimum is $75")).toBe(75);
    expect(parseDetail("minimumCharge", "none")).toBe(0);
    expect(parseDetail("urgentCriteria", "No heat, a leak, or a same-day order")).toEqual(["No heat", "a leak", "a same-day order"]);
    expect(parseDetail("reviewLink", "here: https://g.page/r/abc123/review thanks")).toBe("https://g.page/r/abc123/review");
    expect(parseDetail("reminderFirmness", "Keep it gentle")).toBe("gentle");
    expect(parseDetail("nextStep", "Book a call with me")).toEqual({ lead: "", step: "book_call" });
  });

  it("reads a first name only from words that give one", () => {
    expect(parseDetail("ownerName", "My name is dana")).toBe("Dana");
    expect(parseDetail("ownerName", "Dana")).toBe("Dana");
    expect(parseDetail("ownerName", "we are a family shop")).toBeUndefined();
  });

  it("reads pricing from an answer about what the business sells", () => {
    const found = candidatesFromSales("Tune-ups are $129 and every install gets a quote. Minimum charge is $89.", "owner");
    expect(found.map((c) => c.key)).toEqual(["pricingMethod", "prices", "minimumCharge"]);
    expect(candidateFor("hours", "", "owner", "high")).toBeNull();
  });
});

describe("detailText", () => {
  it("prints each kind of value in plain words", () => {
    expect(detailText("prices", [{ item: "Full", low: 90, high: 120 }])).toBe("Full $90 to $120");
    expect(detailText("minimumCharge", 0)).toBe("No minimum");
    expect(detailText("minimumCharge", 89.5)).toBe("$89.50");
    expect(detailText("pricingMethod", "quote")).toBe("a quote for each request");
    expect(detailText("nextStep", { lead: "", step: "send_estimate" })).toBe("send an estimate");
  });
});

describe("gapsFor and readinessFor", () => {
  it("lists the must fields the active agents share first", () => {
    const gaps = gapsFor(NO_DETAILS, ["frontdesk", "followup"]);
    // Vocabulary and pricing method are must fields for both agents.
    expect(gaps.slice(0, 2)).toEqual(["vocabulary", "pricingMethod"]);
    expect(gaps).not.toContain("reminderFirmness");
  });

  it("counts only must fields toward readiness, and names the next one", () => {
    const empty = readinessFor(NO_DETAILS, "books");
    expect(empty).toEqual({ filled: 0, required: 3, next: "vocabulary" });

    const vocab = parseDetail("vocabulary", "customers / order");
    if (!vocab) throw new Error("test setup: vocabulary should parse");
    const some = readinessFor({ details: { vocabulary: vocab, minimumCharge: 50 } }, "books");
    expect(some).toEqual({ filled: 1, required: 3, next: "pricingMethod" });
  });
});

describe("looksLikeSessionNotes", () => {
  it("skips session notes and transcripts, and reads ordinary business text", () => {
    expect(looksLikeSessionNotes("Session notes, Nov 3: client reported trouble sleeping")).toBe(true);
    expect(looksLikeSessionNotes("Speaker 1: so how was your week\nSpeaker 2: rough")).toBe(true);
    expect(looksLikeSessionNotes("We offer three coaching packages starting at $400.")).toBe(false);
  });
});
