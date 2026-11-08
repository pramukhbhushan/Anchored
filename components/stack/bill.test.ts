import { describe, expect, it } from "vitest";
import { ANCHORED_SEGMENT_NAME, monthlyBill, type BillGroupId, type MonthlyBill } from "@/components/stack/bill";
import { caseStudyById, CASE_STUDIES } from "@/lib/domain/cases";
import { stackCost, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, ChoiceMap } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Checks the bill the cost picture draws: the bar adds up to the total, each
// pick lands in the right group, and quoted or shared tools are counted once.

function caseStudy(id: string): BusinessProfile {
  const business = caseStudyById(id);
  if (business === undefined) throw new Error(`No case study \`${id}\`; check \`lib/domain/cases.ts\`.`);
  return business;
}

function group(bill: MonthlyBill, id: BillGroupId) {
  const found = bill.groups.find((g) => g.id === id);
  if (found === undefined) throw new Error(`Bill has no \`${id}\` group.`);
  return found;
}

describe("monthlyBill", () => {
  it.each(CASE_STUDIES.map((b) => [b.id, b] as const))("adds the bar up to the stack's total for %s", (_, business) => {
    const bill = monthlyBill(business, {});
    const barTotal = bill.segments.reduce((sum, s) => sum + s.amount, 0);
    expect(barTotal).toBeCloseTo(stackCost(business, {}).total);
    expect(bill.total).toBe(stackCost(business, {}).total);
    expect(bill.segments.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it("splits the restaurant into new tools, agents, tools it has and skipped work", () => {
    const bill = monthlyBill(caseStudy("restaurant"), {});
    expect(bill.total).toBe(308);
    expect(group(bill, "buy").lines.map((l) => [l.name, l.price])).toEqual([
      ["Certus", "$250"],
      ["Orders.co Dispute assistant", "$29"],
      ["Homebase", "Free"],
    ]);
    expect(group(bill, "turnon").lines.map((l) => l.name)).toEqual(["OpenTable", "Google Business Profile reply box"]);
    expect(group(bill, "skip").lines.map((l) => l.name)).toEqual([
      "Bookkeeping and invoicing",
      "Lead follow-up",
      "Quotes and estimates",
    ]);
    expect(bill.segments.map((s) => s.name)).toEqual([ANCHORED_SEGMENT_NAME, "Certus", "Orders.co Dispute assistant"]);
    expect(bill.groups.map((g) => g.id)).toEqual(["build", "buy", "turnon", "skip"]);
  });

  it("bills HVAC only for Anchored's agents and lists QuickBooks as already paid", () => {
    const bill = monthlyBill(caseStudy("hvac"), {});
    expect(bill.segments).toEqual([
      { key: "anchored", group: "build", name: ANCHORED_SEGMENT_NAME, amount: 29, share: 1 },
    ]);
    expect(group(bill, "turnon").lines).toEqual([
      expect.objectContaining({ name: "Intuit QuickBooks Online", price: "Already paid" }),
    ]);
  });

  it("says what each agent does in the owner's words", () => {
    const agents = group(monthlyBill(caseStudy("coach"), {}), "build").lines;
    expect(agents.find((a) => a.name === "Bookkeeping and Invoicing")?.does).toEqual([
      "Reminds customers about late invoices",
    ]);
    expect(agents.map((a) => a.name)).toContain("Internal Communications");
  });

  it("keeps a quoted tool out of the bar and the total", () => {
    const hvac = caseStudy("hvac");
    const bill = monthlyBill(hvac, { leads: { path: "buy", toolId: "housecall" } });
    expect(bill.onQuote).toEqual(["Housecall Pro"]);
    expect(group(bill, "buy").lines).toEqual([expect.objectContaining({ name: "Housecall Pro", price: "On quote" })]);
    expect(bill.segments.map((s) => s.key)).toEqual(["anchored"]);
  });

  it("lists a tool picked for two workflows once, with both jobs", () => {
    const hvac = caseStudy("hvac");
    const marketing: Choice = { path: "buy", toolId: "jobber-mkt" };
    const bill = monthlyBill(hvac, { social: marketing, reviews: marketing });
    const lines = group(bill, "buy").lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.does).toHaveLength(2);
    expect(bill.segments.filter((s) => s.key === "jobber-mkt")).toHaveLength(1);
  });

  it("charges nothing and draws no bar when every workflow is skipped", () => {
    const coach = caseStudy("coach");
    const allSkipped: ChoiceMap = Object.fromEntries(workflowIdsOf(coach).map((id) => [id, { path: "skip" }]));
    const bill = monthlyBill(coach, allSkipped);
    expect(bill.total).toBe(0);
    expect(bill.plan).toBe(0);
    expect(bill.segments).toEqual([]);
    expect(group(bill, "skip").lines).toHaveLength(workflowIdsOf(coach).length);
  });
});
