import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ShellLocation } from "@/components/shell/location";
import { Sidebar } from "@/components/shell/Sidebar";
import { AT_HOME, AT_NEW, BUSINESSES, atBusiness } from "@/test/shell-fixtures";

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
    expect(within(nav()).getByText("Sample businesses")).toBeInTheDocument();
  });

  it("marks All businesses as the current page on the business list", () => {
    renderSidebar(AT_HOME);

    expect(within(nav()).getByRole("link", { name: "All businesses" })).toHaveAttribute("aria-current", "page");
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("marks Start a new business as the current page during onboarding", () => {
    renderSidebar(AT_NEW);

    expect(within(nav()).getByRole("link", { name: "Start a new business" })).toHaveAttribute("aria-current", "page");
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
    // The business itself is current, though its overview is not the page.
    expect(within(nav()).getByRole("link", { name: /Rosa's Taqueria/ })).toHaveAttribute("aria-current", "true");
    expect(within(nav()).getByRole("link", { name: /Greenfield Lawn/ })).not.toHaveAttribute("aria-current");
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
