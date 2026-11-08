import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { License } from "@/lib/domain/renewals";
import { deferred, json, sentJson, stubFetch } from "@/test/http";
import { router } from "@/test/next";
import { LicenseDates } from "./LicenseDates";

// =============================================================================
// Module Overview
// =============================================================================
// Exercises the owner's license-date form at the fetch boundary: the exact
// recorded facts, authoritative saves, completion and failure preservation.
// No class names or browser implementation details are part of the assertions.

const permit: License = {
  id: "food-permit",
  name: "Food permit",
  expiresOn: "2027-03-15",
  evidence: "Expiry printed on the permit.",
};

async function fillDate() {
  const user = userEvent.setup();
  await user.click(screen.getByText("License renewal dates"));
  await user.type(screen.getByRole("textbox", { name: "License name" }), "Trade license");
  fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value: "2027-11-20" } });
  await user.type(screen.getByRole("textbox", { name: "Where did you find this date?" }), "Date shown on the county certificate.");
  return user;
}

describe("LicenseDates", () => {
  it("shows recorded facts and says the owner handles renewal", async () => {
    render(<LicenseDates businessId="shop" licenses={[permit]} enabled />);
    await userEvent.setup().click(screen.getByText("License renewal dates"));
    const list = screen.getByRole("list", { name: "Saved licenses" });
    expect(within(list).getByText("Food permit")).toBeInTheDocument();
    expect(within(list).getByText("2027-03-15")).toBeInTheDocument();
    await userEvent.setup().click(within(list).getByText("Date source"));
    expect(within(list).getByText(permit.evidence)).toBeInTheDocument();
    expect(screen.getByText(/Anchored never renews or files anything/)).toBeInTheDocument();
    expect(screen.getByText(/Eastern time/)).toBeInTheDocument();
  });

  it("explains that dates alone do not enable License Clerk", async () => {
    render(<LicenseDates businessId="shop" licenses={[]} enabled={false} />);
    await userEvent.setup().click(screen.getByText("License renewal dates"));
    expect(screen.getByText(/Choose License Clerk on Workflows to receive renewal reminders/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add license" })).toBeEnabled();
  });

  it("saves the complete list and shows only the authoritative returned dates", async () => {
    const fetch = stubFetch(() => json({ licenses: [permit, { ...permit, id: "server-saved", name: "Saved trade license", expiresOn: "2027-11-20" }] }));
    render(<LicenseDates businessId="shop/id" licenses={[permit]} enabled />);
    const user = await fillDate();
    await user.click(screen.getByRole("button", { name: "Add license" }));
    expect(await screen.findByText("Saved trade license")).toBeInTheDocument();
    const request = sentJson(fetch, 0);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("/api/businesses/shop%2Fid/licenses");
    expect(request.body).toEqual({ licenses: [permit, expect.objectContaining({
      id: expect.any(String), name: "Trade license", expiresOn: "2027-11-20", evidence: "Date shown on the county certificate.",
    })] });
    expect(screen.queryByText(/^Trade license$/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "License name" })).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("License dates saved.");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the disclosure and saved result visible when refreshed profile facts arrive", async () => {
    const savedLicenses = [permit, { ...permit, id: "trade-license", name: "Trade license", expiresOn: "2027-11-20" }];
    stubFetch(() => json({ licenses: savedLicenses }));
    const { rerender } = render(<LicenseDates businessId="shop" licenses={[permit]} enabled />);
    const user = await fillDate();
    await user.click(screen.getByRole("button", { name: "Add license" }));
    expect(await screen.findByText("Trade license")).toBeVisible();
    rerender(<LicenseDates businessId="shop" licenses={savedLicenses} enabled />);
    expect(screen.getByRole("list", { name: "Saved licenses" })).toBeVisible();
    expect(screen.getByText("Trade license")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("License dates saved.");
    expect(screen.getByRole("status")).toBeVisible();
    rerender(<LicenseDates businessId="shop" licenses={[{ ...permit, name: "Updated food permit" }]} enabled />);
    expect(await screen.findByText("Updated food permit")).toBeVisible();
    expect(screen.queryByText("Trade license")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add license" })).toBeVisible();
  });

  it("keeps saved dates and attempted facts after a failed save, then allows retry", async () => {
    let attempt = 0;
    const fetch = stubFetch(() => ++attempt === 1 ? json({ error: "Try again shortly." }, 503) : json({ licenses: [permit] }));
    render(<LicenseDates businessId="shop" licenses={[permit]} enabled />);
    const user = await fillDate();
    await user.click(screen.getByRole("button", { name: "Add license" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your change wasn't saved. Try again shortly.");
    expect(screen.getByText("Food permit")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "License name" })).toHaveValue("Trade license");
    expect(screen.getByRole("textbox", { name: "Where did you find this date?" })).toHaveValue("Date shown on the county certificate.");
    expect(router.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Add license" }));
    expect(await screen.findByRole("status")).toHaveTextContent("License dates saved.");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("marks a license handled only after the server saves it", async () => {
    const reply = deferred<Response>();
    const fetch = stubFetch(() => reply.promise);
    render(<LicenseDates businessId="shop" licenses={[permit]} enabled />);
    const user = userEvent.setup();
    await user.click(screen.getByText("License renewal dates"));
    await user.dblClick(screen.getByRole("button", { name: "Mark Food permit handled" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sentJson(fetch, 0).body).toEqual({ licenses: [{ ...permit, completed: true }] });
    expect(screen.queryByText("Handled. Renewal reminders are stopped.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Food permit handled" })).toBeDisabled();
    reply.resolve(json({ licenses: [{ ...permit, completed: true }] }));
    expect(await screen.findByText("Handled. Renewal reminders are stopped.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Food permit handled" })).not.toBeInTheDocument();
  });

  it("removes a recorded date only after the server saves the shorter list", async () => {
    const fetch = stubFetch(() => json({ licenses: [] }));
    render(<LicenseDates businessId="shop" licenses={[permit]} enabled />);
    const user = userEvent.setup();
    await user.click(screen.getByText("License renewal dates"));
    await user.click(screen.getByRole("button", { name: "Remove Food permit date" }));
    expect(await screen.findByText("No license dates saved yet.")).toBeInTheDocument();
    expect(sentJson(fetch, 0).body).toEqual({ licenses: [] });
  });

  it("blocks duplicate adds while a save is pending", async () => {
    const reply = deferred<Response>();
    const fetch = stubFetch(() => reply.promise);
    render(<LicenseDates businessId="shop" licenses={[]} enabled />);
    const user = await fillDate();
    await user.dblClick(screen.getByRole("button", { name: "Add license" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    reply.resolve(json({ licenses: [permit] }));
    expect(await screen.findByText("Food permit")).toBeInTheDocument();
  });

  it("ignores a late save after switching businesses", async () => {
    const reply = deferred<Response>();
    stubFetch(() => reply.promise);
    const { rerender } = render(<LicenseDates businessId="first" licenses={[permit]} enabled />);
    const user = await fillDate();
    await user.click(screen.getByRole("button", { name: "Add license" }));
    rerender(<LicenseDates businessId="second" licenses={[]} enabled />);
    reply.resolve(json({ licenses: [permit] }));
    await user.click(screen.getByText("License renewal dates"));
    await waitFor(() => expect(screen.getByText("No license dates saved yet.")).toBeInTheDocument());
    expect(screen.queryByText("Food permit")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "License name" })).toHaveValue("");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
