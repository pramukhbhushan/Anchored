import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BusinessSwitcher } from "@/components/shell/BusinessSwitcher";
import type { ShellLocation } from "@/components/shell/location";
import type { BusinessSummary } from "@/components/shell/shell-data";
import { APEX, AT_HOME, AT_NEW, BUSINESSES, ROSA, atBusiness } from "@/test/shell-fixtures";

// =============================================================================
// Module Overview
// =============================================================================
// The business picker in the top bar, a button that opens a panel of links:
// it shows where the owner is, lists their businesses apart from the samples
// with each one's trade and approvals waiting, and each link keeps the page
// they were on. The arrow keys and Escape work it from the keyboard.

function trigger(): HTMLElement {
  return screen.getByRole("button", { name: /^Business:/ });
}

/** Render the picker at `location` and open its panel with a click. */
async function openAt(location: ShellLocation, businesses: readonly BusinessSummary[] = BUSINESSES) {
  render(<BusinessSwitcher businesses={businesses} location={location} />);
  await userEvent.click(trigger());
}

function link(name: string | RegExp): HTMLElement {
  return screen.getByRole("link", { name });
}

describe("BusinessSwitcher", () => {
  it("names where the owner is on the button", () => {
    const { rerender } = render(<BusinessSwitcher businesses={BUSINESSES} location={AT_HOME} />);
    expect(trigger()).toHaveAccessibleName("Business: All businesses");

    rerender(<BusinessSwitcher businesses={BUSINESSES} location={atBusiness("rosa", "approvals")} />);
    expect(trigger()).toHaveAccessibleName("Business: Rosa's Taqueria");

    rerender(<BusinessSwitcher businesses={BUSINESSES} location={AT_NEW} />);
    expect(trigger()).toHaveAccessibleName("Business: New business");
  });

  it("opens and closes its panel from the button", async () => {
    await openAt(AT_HOME);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(link("All businesses")).toBeVisible();

    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "All businesses" })).not.toBeInTheDocument();
  });

  it("lists the owner's businesses apart from the samples, between All businesses and Start a new business", async () => {
    await openAt(AT_HOME);

    expect(within(screen.getByRole("list", { name: "Your businesses" })).getByRole("link")).toHaveAccessibleName(
      "Greenfield Lawn, Landscaping, 2 waiting",
    );
    const samples = within(screen.getByRole("list", { name: "Sample businesses" })).getAllByRole("link");
    expect(samples.map((a) => a.textContent)).toEqual([expect.stringContaining("Rosa's Taqueria"), expect.stringContaining("Apex Heating")]);
    const links = screen.getAllByRole("link");
    expect(links.at(0)).toHaveAccessibleName("All businesses");
    expect(links.at(-1)).toHaveAccessibleName("Start a new business");
  });

  it("leaves out the owner's group when they have no business yet", async () => {
    await openAt(AT_HOME, [ROSA, APEX]);

    expect(screen.queryByRole("list", { name: "Your businesses" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Sample businesses" })).toBeInTheDocument();
  });

  it("links each business to the page the owner is on", async () => {
    await openAt(atBusiness("greenfield", "tools"));

    expect(link(/^Rosa's Taqueria/)).toHaveAttribute("href", "/app/b/rosa/tools");
    expect(link(/^Apex Heating/)).toHaveAttribute("href", "/app/b/apex/tools");
    expect(link("All businesses")).toHaveAttribute("href", "/app");
    expect(link("Start a new business")).toHaveAttribute("href", "/app/new");
  });

  it("links each business to its overview from the business list", async () => {
    await openAt(AT_HOME);

    expect(link(/^Apex Heating/)).toHaveAttribute("href", "/app/b/apex");
  });

  it("marks the open business, and only that one", async () => {
    await openAt(atBusiness("rosa", "approvals"));

    expect(link(/^Rosa's Taqueria/)).toHaveAttribute("aria-current", "true");
    expect(link(/^Apex Heating/)).not.toHaveAttribute("aria-current");
    expect(link("All businesses")).not.toHaveAttribute("aria-current");
  });

  it("marks the business list as the current page", async () => {
    await openAt(AT_HOME);
    expect(link("All businesses")).toHaveAttribute("aria-current", "page");
  });

  it("closes once the owner picks a business", async () => {
    await openAt(AT_HOME);

    await userEvent.click(link(/^Apex Heating/));

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on the open business with the down arrow and walks the list with the arrow keys", async () => {
    render(<BusinessSwitcher businesses={BUSINESSES} location={atBusiness("rosa", null)} />);
    trigger().focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(link(/^Rosa's Taqueria/)).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(link(/^Apex Heating/)).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(link("Start a new business")).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(link("All businesses")).toHaveFocus();
  });

  it("opens on the last link with the up arrow", async () => {
    render(<BusinessSwitcher businesses={BUSINESSES} location={AT_NEW} />);
    trigger().focus();

    await userEvent.keyboard("{ArrowUp}");

    expect(link("Start a new business")).toHaveFocus();
    expect(link("Start a new business")).toHaveAttribute("aria-current", "page");
  });

  it("closes with Escape and hands focus back to the button", async () => {
    await openAt(AT_HOME);
    await userEvent.keyboard("{ArrowDown}");
    expect(link("All businesses")).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveFocus();
  });

  it("closes when the owner clicks elsewhere on the page", async () => {
    render(
      <>
        <BusinessSwitcher businesses={BUSINESSES} location={AT_HOME} />
        <p>Elsewhere</p>
      </>,
    );
    await userEvent.click(trigger());

    await userEvent.click(screen.getByText("Elsewhere"));

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});
