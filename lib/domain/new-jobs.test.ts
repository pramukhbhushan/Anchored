import { describe, expect, it } from "vitest";
import { applyChanges, readChanges } from "@/lib/domain/intake";
import { newJobs, withJob } from "@/lib/domain/new-jobs";
import { defaultChoice, workflowIdsOf } from "@/lib/domain/paths";
import { planStatus } from "@/lib/domain/plan";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Jobs beyond the ones onboarding found: which ones the tools page offers an
// HVAC shop, in what order, and what adding one does to the owner's profile,
// including that a later change in the business chat keeps it.

const SHOP = hvacShop();

describe("newJobs", () => {
  it("offers only jobs the business doesn't have yet", () => {
    const mine = workflowIdsOf(SHOP);
    const offered = newJobs(SHOP).map((job) => job.workflow);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.filter((id) => mine.includes(id))).toEqual([]);
  });

  it("leaves out jobs no tool for this trade and no Anchored agent can do", () => {
    // SNAP checks have no tool in the catalog and no agent, so an HVAC shop is never offered one.
    expect(newJobs(SHOP).map((job) => job.workflow)).not.toContain("snap");
    for (const job of newJobs(SHOP)) expect(job.owned.length + job.buy.length > 0 || job.build !== null).toBe(true);
  });

  it("lists tools rated for the business best first, with jobs only Anchored can do last", () => {
    const jobs = newJobs(SHOP);
    const firstAgentOnly = jobs.findIndex((job) => job.owned.length === 0 && job.buy.length === 0);
    expect(firstAgentOnly).toBeGreaterThan(0);
    const withTools = jobs.slice(0, firstAgentOnly).map((job) => job.buy[0]?.rating.total ?? 0);
    expect(withTools).toEqual([...withTools].sort((a, z) => z - a));
    expect(jobs.slice(firstAgentOnly).every((job) => job.build !== null && job.buy.length === 0)).toBe(true);
  });

  it("puts a job first when software the owner already pays for can do it", () => {
    const [first] = newJobs({ ...SHOP, tools: [...SHOP.tools, "Calendly"] });
    expect(first?.workflow).toBe("noshows");
    expect(first?.owned.map((tool) => tool.id)).toEqual(["calendly"]);
  });
});

describe("withJob", () => {
  it("adds the job as the owner's, and the plan alone picks the tool they chose", () => {
    const added = withJob(SHOP, "scheduling", { path: "buy", toolId: "homebase" });
    expect(workflowIdsOf(added)).toContain("scheduling");
    expect(added.workflows.scheduling).toMatchObject({ addedBy: "owner", rec: "buy", tool: "homebase" });
    expect(defaultChoice(added, "scheduling")).toEqual({ path: "buy", toolId: "homebase" });
    // Every job the shop had is still there.
    expect(workflowIdsOf(added)).toEqual(expect.arrayContaining(workflowIdsOf(SHOP)));
  });

  it("shows an added job as a change to a plan the owner already approved", () => {
    const approved = { ...SHOP, planApproval: { approvedAt: "2026-11-07T15:30:00.000Z", choices: {} } };
    const status = planStatus(withJob(approved, "licenses", { path: "build", skills: [] }), {});
    expect(status.kind === "changed" && status.changed).toContain("licenses");
  });

  it("keeps an added job when the owner later changes their profile in the business chat", () => {
    const added = withJob(SHOP, "scheduling", { path: "buy", toolId: "homebase" });
    const { profile, changes } = applyChanges(added, readChanges("we started doing catering"));
    expect(profile.workflows.scheduling).toEqual(added.workflows.scheduling);
    expect(changes).not.toContainEqual(expect.objectContaining({ op: "removed", label: "Staff scheduling" }));
  });
});
