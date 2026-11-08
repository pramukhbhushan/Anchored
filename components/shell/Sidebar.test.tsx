import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { presentAgents } from "@/components/business/agents/view-model";
import { ACTIVE_AGENT_FIXTURES } from "@/components/business/agents/fixtures";
import type { BusinessSummary } from "@/components/shell/shell-data";
import type { ShellLocation } from "@/components/shell/location";
import { Sidebar } from "@/components/shell/Sidebar";
import { AT_HOME, AT_NEW, BUSINESSES, ROSA, atBusiness } from "@/test/shell-fixtures";

// =============================================================================
// Module Overview
// =============================================================================
// The sidebar as an owner moves around with it: every business they can open,
// the open business's pages with its approvals count, and `aria-current` on
// the page they are on, so a screen reader says where they are.

function renderSidebar(location: ShellLocation, overrides: { collapsed?: boolean; onToggleCollapsed?: () => void; onClose?: () => void } = {}) {
  return render(
    <Sidebar
      businesses={BUSINESSES}
      location={location}
      open={false}
      collapsed={overrides.collapsed ?? false}
      closeRef={createRef<HTMLButtonElement>()}
      onClose={overrides.onClose ?? vi.fn()}
      onToggleCollapsed={overrides.onToggleCollapsed ?? vi.fn()}
      handle={<div role="separator" aria-label="Resize sidebar" />}
    />,
  );
}

function nav(): HTMLElement {
  return screen.getByRole("navigation", { name: "Businesses and pages" });
}

describe("Sidebar", () => {
  it("lists every business the owner can open, linked to its overview", () => {
    renderSidebar(AT_HOME);

    expect(within(nav()).getByRole("link", { name: /Greenfield Lawn/ })).toHaveAttribute("href", "/app/b/greenfield");
    expect(within(nav()).getByRole("link", { name: /Rosa's Taqueria/ })).toHaveAttribute("href", "/app/b/rosa");
    expect(within(nav()).getByRole("link", { name: /Apex Heating/ })).toHaveAttribute("href", "/app/b/apex");
    expect(within(nav()).getByText("Your businesses")).toBeInTheDocument();
    expect(within(nav()).getByText("Example")).toBeInTheDocument();
  });

  it("marks All businesses as the current page on the business list", () => {
    renderSidebar(AT_HOME);

    expect(within(nav()).getByRole("link", { name: "All businesses" })).toHaveAttribute("aria-current", "page");
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("marks Set up a new business as the current page during onboarding", () => {
    renderSidebar(AT_NEW);

    expect(within(nav()).getByRole("link", { name: "Set up a new business" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "All businesses" })).not.toHaveAttribute("aria-current");
  });

  it("lists the open business's pages and marks the one the owner is on", () => {
    renderSidebar(atBusiness("rosa", "tools"));

    const tools = within(nav()).getByRole("link", { name: "Tools" });
    expect(tools).toHaveAttribute("href", "/app/b/rosa/tools");
    expect(tools).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/app/b/rosa");
    expect(within(nav()).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    // Inside a business the top bar's switcher does the switching, so the sidebar lists no other business.
    expect(within(nav()).queryByRole("link", { name: /Greenfield Lawn/ })).not.toBeInTheDocument();
    expect(within(nav()).queryByText("Example")).not.toBeInTheDocument();
  });

  it("marks the overview as the page on a business's front page", () => {
    renderSidebar(atBusiness("greenfield", null));

    expect(within(nav()).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("says how many approvals wait beside Approvals", () => {
    renderSidebar(atBusiness("rosa", null));

    expect(within(nav()).getByRole("link", { name: /^Approvals\W+3 waiting$/ })).toHaveAttribute("href", "/app/b/rosa/approvals");
  });

  it("collapses to an icon rail on request, which has no resize handle", async () => {
    const onToggleCollapsed = vi.fn();
    const { rerender } = renderSidebar(AT_HOME, { onToggleCollapsed });
    expect(screen.getByRole("separator", { name: "Resize sidebar" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);

    rerender(
      <Sidebar
        businesses={BUSINESSES}
        location={AT_HOME}
        open={false}
        collapsed
        closeRef={createRef<HTMLButtonElement>()}
        onClose={vi.fn()}
        onToggleCollapsed={onToggleCollapsed}
        handle={<div role="separator" aria-label="Resize sidebar" />}
      />,
    );
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("closes the phone drawer from its close button", async () => {
    const onClose = vi.fn();
    renderSidebar(AT_HOME, { onClose });

    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});


const AGENT_BUSINESS: BusinessSummary = {
  ...ROSA,
  agents: presentAgents(ACTIVE_AGENT_FIXTURES),
};

function renderAgentSidebar(location: ShellLocation, collapsed = false) {
  return render(<Sidebar businesses={[AGENT_BUSINESS]} location={location} open={false} collapsed={collapsed} closeRef={createRef<HTMLButtonElement>()} onClose={vi.fn()} onToggleCollapsed={vi.fn()} handle={null} />);
}

describe("agent navigation in Sidebar", () => {
  it("lists active agents and niche agents as direct destinations", () => {
    renderAgentSidebar({ page: "business", businessId: "rosa", section: "workflows" });
    const agents = within(nav()).getByRole("list", { name: "Agents" });
    expect(within(agents).getByRole("link", { name: "Customer" })).toHaveAttribute("href", "/app/b/rosa/workflows/customer");
    expect(within(agents).getByRole("link", { name: "Stock Check" })).toHaveAttribute("href", "/app/b/rosa/workflows/niche%3Astock-check");
    expect(within(nav()).getByRole("link", { name: "Workflows" })).toHaveAttribute("aria-current", "page");
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("marks only the open agent as current", () => {
    renderAgentSidebar({ page: "business", businessId: "rosa", section: "workflows", agent: "customer" });
    expect(within(nav()).getByRole("link", { name: "Customer" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "Workflows" })).not.toHaveAttribute("aria-current");
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("keeps agent destinations available in the collapsed rail", () => {
    renderAgentSidebar({ page: "business", businessId: "rosa", section: "workflows", agent: "customer" }, true);
    expect(screen.getByRole("list", { name: "Agents" })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: "Customer" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "Customer" })).toHaveAttribute("title", "Customer");
    expect(within(nav()).getByRole("link", { name: "Workflows" })).not.toHaveAttribute("aria-current");
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
});


describe("main frontend and agent integration", () => {
  it("keeps business-area groups on Workflows instead of repeating them in navigation", () => {
    const business = { ...AGENT_BUSINESS, automations: [{ key: "nudger", name: "Remind about invoices", stage: "Getting paid", href: "/app/b/rosa/workflows/books/nudger", waiting: 1 }] };
    render(<Sidebar businesses={[business]} location={{ page: "business", businessId: "rosa", section: "workflows", automation: "nudger" }} open={false} collapsed={false} closeRef={createRef<HTMLButtonElement>()} onClose={vi.fn()} onToggleCollapsed={vi.fn()} handle={null} />);
    expect(screen.getByRole("list", { name: "Agents" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Automations" })).not.toBeInTheDocument();
    expect(screen.queryByText("Getting paid")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Remind about invoices/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toHaveAttribute("aria-current", "page");
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
});
