import { describe, expect, it } from "vitest";
import { DISCOVERY_QUEUE } from "./catalog";
import { DISCOVERED, discoveryListingSchema } from "./discovered";
import { MAX_LISTINGS_PER_RUN, sourceLabel, vetCandidates, type DiscoveryCandidate, type DiscoveryInput } from "./discovery";

// =============================================================================
// Module Overview
// =============================================================================
// The rules a discovered tool passes before it joins the queue: a real source
// page, a name the research mentions, nothing Anchored already lists, and a cap
// per run. Also checks that the agent's file parses and reaches the queue.

const PAGES = [
  { url: "https://www.getweave.com/pricing/?utm_source=ads", title: "Weave pricing" },
  { url: "https://www.dentalai.example/blog/best-ai-receptionists", title: "Best AI receptionists" },
];

const FINDINGS = "Weave answers missed calls and texts patients back. Arini is an AI receptionist for dental offices.";

/** A candidate with every field filled; override what a test is about. */
function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    name: "Weave",
    maker: "Weave",
    source: 1,
    price: "From $249 a month",
    connects: "Dentrix, Eaglesoft",
    contract: "Annual contract",
    data: "",
    ...overrides,
  };
}

/** One run for the calls workflow on Nov 8, 2026, with nothing listed yet unless `known` says so. */
function run(candidates: DiscoveryCandidate[], overrides: Partial<DiscoveryInput> = {}) {
  return vetCandidates({ candidates, pages: PAGES, findings: FINDINGS, workflow: "calls", foundOn: "Nov 8, 2026", known: [], ...overrides });
}

describe("vetCandidates", () => {
  it("lists a tool from a searched page, with the workflow, date and page set by code", () => {
    const { listings, skipped } = run([candidate()]);

    expect(skipped).toEqual([]);
    expect(listings).toEqual([
      {
        name: "Weave",
        workflow: "calls",
        price: "From $249 a month",
        connects: "Dentrix, Eaglesoft",
        data: "Not stated",
        contract: "Annual contract",
        source: "getweave.com/pricing",
        url: "https://www.getweave.com/pricing/?utm_source=ads",
        foundOn: "Nov 8, 2026",
      },
    ]);
  });

  it("skips a tool Anchored already lists in its catalog", () => {
    const { listings, skipped } = run([candidate({ name: "Certus", maker: "Certus" })], {
      findings: "Certus answers restaurant calls.",
      known: undefined,
    });

    expect(listings).toEqual([]);
    expect(skipped).toEqual([{ name: "Certus", reason: "Anchored already lists it" }]);
  });

  it("skips a tool whose source isn't a page the search returned", () => {
    const { listings, skipped } = run([candidate({ source: 3 }), candidate({ name: "Arini", maker: "", source: 0 })]);

    expect(listings).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual([
      "Its source isn't a page the search returned",
      "Its source isn't a page the search returned",
    ]);
  });

  it("skips a tool the research never mentions", () => {
    const { skipped } = run([candidate({ name: "Phantom Desk", maker: "" })]);

    expect(skipped).toEqual([{ name: "Phantom Desk", reason: "The research never mentions it" }]);
  });

  it("puts the maker in front of the name and lists each tool once per run", () => {
    const { listings, skipped } = run([
      candidate({ name: "Receptionist", maker: "Weave" }),
      candidate({ name: "Weave Receptionist", maker: "Weave" }),
    ], { findings: `${FINDINGS} Weave Receptionist picks up after hours.` });

    expect(listings.map((l) => l.name)).toEqual(["Weave Receptionist"]);
    expect(skipped).toEqual([{ name: "Weave Receptionist", reason: "Anchored already lists it" }]);
  });

  it("skips a name that is really a web address", () => {
    const { skipped } = run([candidate({ name: "https://getweave.com", maker: "" })]);

    expect(skipped).toEqual([{ name: "https://getweave.com", reason: "The name isn't a product name" }]);
  });

  it(`adds at most ${MAX_LISTINGS_PER_RUN} tools in one run`, () => {
    const names = Array.from({ length: MAX_LISTINGS_PER_RUN + 2 }, (_, i) => `Tool${i}`);
    const { listings, skipped } = run(
      names.map((name) => candidate({ name, maker: "" })),
      { findings: names.join(" ") },
    );

    expect(listings).toHaveLength(MAX_LISTINGS_PER_RUN);
    expect(skipped).toHaveLength(2);
  });
});

describe("sourceLabel", () => {
  it("drops the scheme, www, query and trailing slash", () => {
    expect(sourceLabel("https://www.getweave.com/pricing/?utm_source=ads#plans")).toBe("getweave.com/pricing");
  });
});

describe("the discovered file", () => {
  it("parses, and every listing in it waits in the queue", () => {
    for (const listing of DISCOVERED) expect(DISCOVERY_QUEUE).toContain(listing);
  });

  it("rejects a listing with no web address or an unknown workflow", () => {
    const listing = {
      name: "Weave",
      workflow: "calls",
      price: "Not stated",
      connects: "Not stated",
      data: "Not stated",
      contract: "Not stated",
      source: "getweave.com",
      url: "https://getweave.com",
      foundOn: "Nov 8, 2026",
    };

    expect(discoveryListingSchema.safeParse(listing).success).toBe(true);
    expect(discoveryListingSchema.safeParse({ ...listing, url: "javascript:alert(1)" }).success).toBe(false);
    expect(discoveryListingSchema.safeParse({ ...listing, workflow: "payroll" }).success).toBe(false);
  });
});
