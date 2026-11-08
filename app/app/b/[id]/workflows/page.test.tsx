import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { approvePlan } from "@/lib/domain/plan";
import type { BusinessProfile } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// What the Workflows page shows an owner: Anchored's plan waiting for a yes,
// live once approved, or changed since; and one graph of the business's day
// in stages, each workflow told as its steps with no path words. The page
// reads a real in-memory store under a fixed session.

const SESSION = "owner-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));

const { default: WorkflowsPage } = await import("./page");

/** Render the Workflows page for business `id`. */
async function renderWorkflows(id: string) {
  render(<ToastProvider>{await WorkflowsPage({ params: Promise.resolve({ id }) })}</ToastProvider>);
}

/** The plan band's region. */
function plan(): HTMLElement {
  return screen.getByRole("region", { name: /plan|changed/i });
}

/** The graph's entry for workflow `name`. */
function job(name: string): HTMLElement {
  return screen.getByRole("listitem", { name });
}

const SHOP: BusinessProfile = hvacShop();

beforeEach(async () => {
  stores.current = new MemoryStore();
  await stores.current.saveBusiness(SESSION, SHOP);
});

describe("Workflows page", () => {
  it("leads with Anchored's plan and one button to approve it", async () => {
    await renderWorkflows(SHOP.id);

    expect(within(plan()).getByRole("heading", { name: "Here's your plan" })).toBeInTheDocument();
    expect(within(plan()).getByRole("button", { name: "Approve this plan" })).toBeInTheDocument();
  });

  it("shows the plan as live, with the day it was approved, once the owner approves", async () => {
    const approval = approvePlan(SHOP, {}, new Date("2026-11-07T15:30:00.000Z"));
    await stores.current?.saveBusiness(SESSION, { ...SHOP, planApproval: approval });
    await renderWorkflows(SHOP.id);

    expect(within(plan()).getByRole("heading", { name: "Your plan is live" })).toBeInTheDocument();
    expect(plan()).toHaveTextContent("You approved it on Nov 7, 2026.");
    expect(within(plan()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks the owner to approve a step they changed after approving", async () => {
    const approval = approvePlan(SHOP, {}, new Date("2026-11-07T15:30:00.000Z"));
    await stores.current?.saveBusiness(SESSION, { ...SHOP, planApproval: approval });
    await stores.current?.setChoice(SESSION, SHOP.id, "calls", { path: "skip" });
    await renderWorkflows(SHOP.id);

    expect(within(plan()).getByRole("heading", { name: "You changed a step" })).toBeInTheDocument();
    expect(plan()).toHaveTextContent("Answer and return calls changed since you approved the plan");
    expect(within(plan()).getByRole("button", { name: "Approve changes" })).toBeInTheDocument();
    expect(within(job("Answer and return calls")).getByText("Changed")).toBeInTheDocument();
  });

  it("keeps the example's approval and points a visitor to their own business", async () => {
    await stores.current?.setChoice(SESSION, SAMPLE_BUSINESS.id, "calls", { path: "skip" });
    await renderWorkflows(SAMPLE_BUSINESS.id);

    expect(within(plan()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(plan()).getByRole("link", { name: "Set up your own business" })).toHaveAttribute("href", "/app/new");
  });

  it("lays the day out in stages, one graph with no shared or added split", async () => {
    await renderWorkflows(SAMPLE_BUSINESS.id);

    const stages = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(stages).toEqual(expect.arrayContaining(["Getting customers", "Serving customers", "Getting paid and running the shop"]));
    expect(stages.indexOf("Getting customers")).toBeLessThan(stages.indexOf("Serving customers"));
    expect(screen.queryByText(/Shared by every business|Added from/)).not.toBeInTheDocument();
  });

  it("tells each workflow as its steps, with the owner's OK on what Anchored drafts", async () => {
    await renderWorkflows(SAMPLE_BUSINESS.id);

    const catering = job("Catering and events");
    expect(catering).toHaveTextContent("It starts when: Someone asks about catering for an event");
    expect(catering).toHaveTextContent("Who handles it: Anchored drafts it");
    expect(catering).toHaveTextContent("You approveA reply with three packages to pick from");
    expect(catering).toHaveTextContent(/You get: A catering order on the books\s*About \$4,700 a year/);
    expect(job("Answer and return calls")).toHaveTextContent("Who handles it: CertusNew, $250 a month");
  });

  it("offers who else could handle a workflow as outcomes, and a way to compare tools", async () => {
    await renderWorkflows(SAMPLE_BUSINESS.id);

    const calls = job("Answer and return calls");
    const options = within(calls).getByRole("list", { name: "Who could handle Answer and return calls" });
    expect(within(options).getByRole("button", { name: /Let Anchored draft it for your OK/ })).toBeInTheDocument();
    expect(within(options).getByRole("button", { name: /Leave it for now/ })).toBeInTheDocument();
    expect(within(options).getByText("Handles it now")).toBeInTheDocument();
    expect(within(calls).getByRole("link", { name: "Compare tools for Answer and return calls" })).toHaveAttribute(
      "href",
      "/app/b/restaurant/tools?workflow=calls",
    );
  });

  it("never shows the path stamps or their words", async () => {
    await renderWorkflows(SAMPLE_BUSINESS.id);

    // A vendor's researched note may say "if you buy it"; the stamps' labels are what must not appear.
    for (const region of [screen.getByRole("region", { name: /runs day to day/ }), plan()]) {
      expect(region).not.toHaveTextContent(/turn on|skip/i);
      expect(region).not.toHaveTextContent(/\b(Buy|Build|BUY|BUILD)\b/);
    }
  });
});
