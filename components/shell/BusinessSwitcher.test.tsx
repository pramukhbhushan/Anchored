import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BusinessSwitcher } from "@/components/shell/BusinessSwitcher";
import type { BusinessSummary } from "@/components/shell/shell-data";
import { router } from "@/test/next";
import { APEX, AT_HOME, AT_NEW, BUSINESSES, ROSA, atBusiness } from "@/test/shell-fixtures";

// =============================================================================
// Module Overview
// =============================================================================
// The business picker in the top bar, a native select: it shows where the
// owner is, lists their businesses apart from the samples, and picking one
// goes there, keeping the page they were on.

function picker(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Business" });
}

describe("BusinessSwitcher", () => {
  it("lists the owner's businesses apart from the samples, between All businesses and Start a new business", () => {
    render(<BusinessSwitcher businesses={BUSINESSES} location={AT_HOME} />);

    expect(within(picker()).getByRole("group", { name: "Your businesses" })).toHaveTextContent("Greenfield Lawn");
    const samples = within(picker()).getByRole("group", { name: "Sample businesses" });
    expect(samples).toHaveTextContent("Rosa's Taqueria");
    expect(samples).toHaveTextContent("Apex Heating");
    const options = within(picker()).getAllByRole("option");
    expect(options.at(0)).toHaveTextContent("All businesses");
    expect(options.at(-1)).toHaveTextContent(/Start a new business/);
  });

  it("leaves out the owner's group when they have no business yet", () => {
    const samplesOnly: readonly BusinessSummary[] = [ROSA, APEX];
    render(<BusinessSwitcher businesses={samplesOnly} location={AT_HOME} />);

    expect(within(picker()).queryByRole("group", { name: "Your businesses" })).not.toBeInTheDocument();
  });

  it("shows where the owner is", () => {
    const { rerender } = render(<BusinessSwitcher businesses={BUSINESSES} location={AT_HOME} />);
    expect(picker()).toHaveDisplayValue("All businesses");

    rerender(<BusinessSwitcher businesses={BUSINESSES} location={atBusiness("rosa", "approvals")} />);
    expect(picker()).toHaveDisplayValue("Rosa's Taqueria");

    rerender(<BusinessSwitcher businesses={BUSINESSES} location={AT_NEW} />);
    expect(picker()).toHaveDisplayValue(/Start a new business/);
  });

  it("opens the picked business on the page the owner was on", async () => {
    render(<BusinessSwitcher businesses={BUSINESSES} location={atBusiness("greenfield", "tools")} />);

    await userEvent.selectOptions(picker(), "Rosa's Taqueria");

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/b/rosa/tools");
  });

  it("opens the picked business's overview from the business list", async () => {
    render(<BusinessSwitcher businesses={BUSINESSES} location={AT_HOME} />);

    await userEvent.selectOptions(picker(), "Apex Heating");

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/b/apex");
  });

  it("goes to the business list or onboarding from the two app-wide choices", async () => {
    render(<BusinessSwitcher businesses={BUSINESSES} location={atBusiness("rosa", "tools")} />);

    await userEvent.selectOptions(picker(), "All businesses");
    expect(router.push).toHaveBeenLastCalledWith("/app");

    await userEvent.selectOptions(picker(), within(picker()).getByRole("option", { name: /Start a new business/ }));
    expect(router.push).toHaveBeenLastCalledWith("/app/new");
  });
});
