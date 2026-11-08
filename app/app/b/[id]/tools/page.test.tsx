import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import type { BusinessProfile } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { json, sentJson, stubFetch } from "@/test/http";
import { router } from "@/test/next";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// What the tools page shows an owner discovering AI tools: jobs they could
// hand off beyond the ones onboarding found, each with a button that adds it
// to their workflows; the ranked tools for the jobs they have; and the tools
// the discovery agent just found. The page reads a real in-memory store under
// a fixed session.

const SESSION = "owner-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));

const { default: ToolsPage } = await import("./page");

/** Render the tools page for business `id`, with `query` as the URL's search params. */
async function renderTools(id: string, query: Record<string, string> = {}) {
  render(<ToastProvider>{await ToolsPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) })}</ToastProvider>);
}

/** The "More jobs you could hand off" band. */
function newJobsBand(): HTMLElement {
  return screen.getByRole("region", { name: "More jobs you could hand off" });
}

/** A job's card in the band. */
function jobCard(name: string): HTMLElement {
  return within(newJobsBand()).getByRole("article", { name });
}

const SHOP: BusinessProfile = hvacShop();

beforeEach(async () => {
  stores.current = new MemoryStore();
  await stores.current.saveBusiness(SESSION, SHOP);
});

describe("Tools page", () => {
  it("is headed as the place to discover AI tools", async () => {
    await renderTools(SHOP.id);
    expect(screen.getByRole("heading", { level: 1, name: "Discover AI tools" })).toBeInTheDocument();
  });

  it("offers jobs onboarding didn't pick, with the tools rated for this business", async () => {
    await renderTools(SHOP.id);

    const scheduling = jobCard("Staff scheduling");
    expect(within(scheduling).getByRole("list", { name: "Tools for staff scheduling" })).toHaveTextContent(/Fit \d+\/100/);
    // The shop already answers calls, so that job isn't offered again.
    expect(within(newJobsBand()).queryByRole("article", { name: "Answer and return calls" })).not.toBeInTheDocument();
  });

  it("says when only Anchored can do a job", async () => {
    await renderTools(SHOP.id);
    const licenses = jobCard("License renewals");
    expect(licenses).toHaveTextContent("No tool in our catalog does this yet.");
    expect(within(licenses).getByRole("button", { name: "Add with Anchored for license renewals" })).toBeInTheDocument();
  });

  it("adds a job with its best-rated tool, says so with a link to Workflows, and refreshes the page", async () => {
    const fetchSpy = stubFetch(() => json({ workflow: "scheduling", choice: { path: "buy", toolId: "homebase" } }));
    await renderTools(SHOP.id);

    await userEvent.click(within(jobCard("Staff scheduling")).getByRole("button", { name: /^Add with (?!Anchored).+ for staff scheduling$/ }));

    const sent = sentJson(fetchSpy, 0);
    expect(sent).toMatchObject({ method: "POST", url: `/api/businesses/${SHOP.id}/workflows`, body: { workflow: "scheduling", path: "buy" } });
    expect(await screen.findByText(/Staff scheduling is in your workflows with .+\. It starts once you sign up\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See it in Workflows" })).toHaveAttribute("href", `/app/b/${SHOP.id}/workflows#wf-scheduling`);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("offers Anchored as a second way in when a tool leads", async () => {
    await renderTools(SHOP.id);
    const reminders = jobCard("No-shows and reminders");
    expect(within(reminders).getAllByRole("button").map((button) => button.textContent)).toEqual([expect.stringMatching(/^Add with /), "Or add with Anchored"]);
  });

  it("keeps the ranked tools for the jobs the business has", async () => {
    await renderTools(SHOP.id);
    const yours = screen.getByRole("region", { name: "Tools for the jobs you have" });
    expect(within(yours).getAllByRole("button", { name: /^(Choose|Use) / }).length).toBeGreaterThan(0);
  });

  it("shows only the ranked tools when filtered to one of the business's jobs", async () => {
    await renderTools(SHOP.id, { workflow: "calls" });
    expect(screen.queryByRole("region", { name: "More jobs you could hand off" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tools for the jobs you have" })).toBeInTheDocument();
  });

  it("shows the example's extra jobs with a way to set up a business of one's own, not buttons", async () => {
    await renderTools(SAMPLE_BUSINESS.id);
    expect(within(newJobsBand()).getByRole("link", { name: "Set up your own business" })).toHaveAttribute("href", "/app/new");
    expect(within(newJobsBand()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the tools the discovery agent just found", async () => {
    await renderTools(SAMPLE_BUSINESS.id);
    const summary = screen.getByText(/^Just found: \d+ new tools? waiting for a person to check/);
    expect(summary.closest("details")).toHaveAttribute("open");
  });
});
