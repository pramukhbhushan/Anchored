import { describe, expect, it } from "vitest";
import type { LlmProvider, ObjectRequest, WebFindings, WebSearchRequest } from "@/lib/llm";
import { DiscoveryUnavailableError, discoverTools } from "./discover";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the discovery agent with a scripted model: what it asks the web
// search, which entries reach the queue, and what happens when no provider can
// search. No request leaves the process.

const FINDINGS: WebFindings = {
  text: "Arini answers calls for dental offices, $300 a month. Phantom Desk is mentioned in a forum post.",
  sources: [
    { url: "https://www.arini.ai/pricing", title: "Arini pricing" },
    { url: "https://forum.example/thread/12", title: "Forum thread" },
  ],
};

const EXTRACTED = {
  tools: [
    { name: "Arini", maker: "Arini", source: 1, price: "$300 a month", connects: "Dentrix", contract: "Not stated", data: "Not stated" },
    { name: "Ghost Agent", maker: "", source: 2, price: "Not stated", connects: "Not stated", contract: "Not stated", data: "Not stated" },
    { name: "Phantom Desk", maker: "", source: 7, price: "Not stated", connects: "Not stated", contract: "Not stated", data: "Not stated" },
  ],
};

/** A model that answers the search with `findings` and the extraction with `extracted`, recording each search request. */
function scriptedModel(findings: WebFindings, extracted: unknown = EXTRACTED) {
  const searches: WebSearchRequest[] = [];
  let extractions = 0;
  const llm: LlmProvider = {
    name: "anthropic",
    label: "Claude",
    modelFor: () => "claude-sonnet-5-5",
    generateText: async () => "unused",
    generateObject: async <T>(request: ObjectRequest<T>) => {
      extractions += 1;
      return request.schema.parse(extracted);
    },
    searchWeb: async (request) => {
      searches.push(request);
      return findings;
    },
  };
  return { llm, searches, extractions: () => extractions };
}

const NOV_8_EVENING_EASTERN = new Date("2026-11-09T01:30:00Z");

describe("discoverTools", () => {
  it("searches for the job and the business, and lists only the tools that pass the rules", async () => {
    const { llm, searches } = scriptedModel(FINDINGS);

    const run = await discoverTools({ workflow: "calls", business: "dental office", llm, now: NOV_8_EVENING_EASTERN });

    expect(searches).toHaveLength(1);
    expect(searches[0]?.prompt).toContain("dental office");
    expect(searches[0]?.prompt).toContain("answer and return calls");
    expect(run.pagesRead).toBe(2);
    expect(run.listings).toEqual([
      {
        name: "Arini",
        workflow: "calls",
        price: "$300 a month",
        connects: "Dentrix",
        data: "Not stated",
        contract: "Not stated",
        source: "arini.ai/pricing",
        url: "https://www.arini.ai/pricing",
        foundOn: "Nov 8, 2026",
      },
    ]);
    expect(run.skipped).toEqual([
      { name: "Ghost Agent", reason: "The research never mentions it" },
      { name: "Phantom Desk", reason: "Its source isn't a page the search returned" },
    ]);
  });

  it("skips a name an earlier run already added", async () => {
    const { llm } = scriptedModel(FINDINGS);

    const run = await discoverTools({ workflow: "calls", business: "dental office", llm, alsoKnown: ["Arini"] });

    expect(run.listings).toEqual([]);
    expect(run.skipped[0]).toEqual({ name: "Arini", reason: "Anchored already lists it" });
  });

  it("stops before extracting when the search found no pages", async () => {
    const { llm, extractions } = scriptedModel({ text: "Nothing found.", sources: [] });

    const run = await discoverTools({ workflow: "calls", business: "dental office", llm });

    expect(run).toEqual({ listings: [], skipped: [], pagesRead: 0 });
    expect(extractions()).toBe(0);
  });

  it("refuses to run when AI is off or the provider can't search", async () => {
    const { llm } = scriptedModel(FINDINGS);
    const { searchWeb: _unused, ...noSearch } = llm;

    await expect(discoverTools({ workflow: "calls", business: "dental office", llm: null })).rejects.toThrow(DiscoveryUnavailableError);
    await expect(discoverTools({ workflow: "calls", business: "dental office", llm: noSearch })).rejects.toThrow(
      "Claude can't search the web from Anchored",
    );
  });
});
