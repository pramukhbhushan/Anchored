import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deferred, json, sentJson, stubFetch } from "@/test/http";
import { router } from "@/test/next";
import type { RecordedFollowup } from "@/lib/domain/followups";
import { FollowupSchedule } from "./FollowupSchedule";

// =============================================================================
// Module Overview
// =============================================================================
// The follow-up form, tested at `fetch`: the request it sends and the due time
// it converts, what a failed save keeps, the list the server returns, the
// guard against a double tap, and a late reply after switching businesses.

const contacts = [{ id: "customer-1", name: "Sam" }];
const record: RecordedFollowup = { id: "timer-1", businessId: "shop", contactId: "customer-1", skill: "closer", dueAt: "2026-11-10T15:00:00.000Z", sourceId: "quote:Q1", evidence: "Owner recorded this quote as open.", state: "open-quote", status: "active" };
const LOCAL_DUE = "2026-11-10T10:00";

async function openSchedule() {
  const user = userEvent.setup();
  await user.click(screen.getByText("Scheduled follow-ups"));
  return user;
}

async function fillSchedule(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText("Draft due (your device's local time)"), { target: { value: LOCAL_DUE } });
  await user.type(screen.getByLabelText("Quote, call or job reference"), "quote:Q1");
  await user.type(screen.getByLabelText("Where this fact came from"), "Owner recorded this quote as open.");
  await user.click(screen.getByRole("checkbox", { name: /I have recorded this fact/ }));
}

describe("FollowupSchedule", () => {
  it("explains missing skills or customers and never offers a direct send", async () => {
    const { rerender } = render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={[]} />);
    await openSchedule();
    expect(screen.getByText(/Choose a follow-up job on Workflows/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record follow-up" })).not.toBeInTheDocument();
    rerender(<FollowupSchedule businessId="another" records={[]} contacts={[]} skills={["closer"]} />);
    await openSchedule();
    expect(screen.getByText(/No customers are recorded yet/)).toBeInTheDocument();
    expect(screen.getByText(/Customer drafts go out on Telegram/)).toBeInTheDocument();
    expect(screen.getByText(/Every message waits in Approvals/)).toBeInTheDocument();
  });

  it("records the chosen customer, explicit state, evidence and converted time, then shows only the server's saved result", async () => {
    const fetch = stubFetch(() => json({ records: [record] }));
    render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={["closer", "inquiry"]} />);
    const user = await openSchedule();
    expect(screen.getByRole("button", { name: "Record follow-up" })).toBeDisabled();
    expect(screen.queryByRole("option", { name: "Inquiry Responder" })).not.toBeInTheDocument();
    await fillSchedule(user);
    await user.click(screen.getByRole("button", { name: "Record follow-up" }));
    expect(sentJson(fetch, 0)).toEqual({ method: "POST", url: "/api/businesses/shop/followups", body: { contactId: "customer-1", skill: "closer", dueAt: new Date(LOCAL_DUE).toISOString(), state: "open-quote", sourceId: "quote:Q1", evidence: record.evidence } });
    expect(await screen.findByRole("button", { name: "Cancel Closer for Sam" })).toBeInTheDocument();
    expect(screen.getByText("Closer: Sam")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Follow-up recorded");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("requires new confirmation after changing the recorded job state and never infers completion from payment", async () => {
    const fetch = stubFetch(() => json({ records: [] }));
    render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={["closer", "reviewer"]} />);
    const user = await openSchedule();
    await fillSchedule(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Follow-up job" }), "reviewer");
    expect(screen.getByRole("checkbox", { name: /The job has finished/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Record follow-up" })).toBeDisabled();
    expect(screen.getByText(/A paid invoice alone does not show/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /The job has finished/ }));
    await user.click(screen.getByRole("button", { name: "Record follow-up" }));
    expect(sentJson(fetch, 0).body).toMatchObject({ skill: "reviewer", state: "completed-job" });
  });

  it("retains attempted input and saved records on failure", async () => {
    stubFetch(() => json({ error: "The recorded quote was not saved. Try again." }, 503));
    render(<FollowupSchedule businessId="shop" records={[record]} contacts={contacts} skills={["closer"]} />);
    const user = await openSchedule();
    await fillSchedule(user);
    await user.click(screen.getByRole("button", { name: "Record follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The recorded quote was not saved");
    expect(screen.getByLabelText("Quote, call or job reference")).toHaveValue("quote:Q1");
    expect(screen.getByLabelText("Where this fact came from")).toHaveValue(record.evidence);
    expect(screen.getByLabelText("Draft due (your device's local time)")).toHaveValue(LOCAL_DUE);
    expect(screen.getByRole("button", { name: "Cancel Closer for Sam" })).toBeEnabled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("cancels by record id and shows the canceled record the server returns", async () => {
    const fetch = stubFetch(() => json({ records: [{ ...record, status: "cancelled" }] }));
    render(<FollowupSchedule businessId="shop" records={[record]} contacts={contacts} skills={["closer"]} />);
    const user = await openSchedule();
    await user.click(screen.getByRole("button", { name: "Cancel Closer for Sam" }));
    expect(sentJson(fetch, 0)).toEqual({ method: "PUT", url: "/api/businesses/shop/followups", body: { id: record.id } });
    expect(await screen.findByText("Canceled")).toBeInTheDocument();
    expect(screen.getByText("Closer: Sam")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Closer for Sam" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("saved record is kept");
  });

  it("keeps the saved schedule after a cancellation error", async () => {
    stubFetch(() => json({ error: "Check your connection and try again." }, 500));
    render(<FollowupSchedule businessId="shop" records={[record]} contacts={contacts} skills={["closer"]} />);
    const user = await openSchedule();
    await user.click(screen.getByRole("button", { name: "Cancel Closer for Sam" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection");
    expect(screen.getByRole("button", { name: "Cancel Closer for Sam" })).toBeEnabled();
    expect(screen.queryByText("Canceled")).not.toBeInTheDocument();
  });

  it("blocks duplicate requests until the saved response arrives", async () => {
    const reply = deferred<Response>();
    const fetch = stubFetch(() => reply.promise);
    render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={["closer"]} />);
    const user = await openSchedule();
    await fillSchedule(user);
    await user.dblClick(screen.getByRole("button", { name: "Record follow-up" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Recording..." })).toBeDisabled();
    reply.resolve(json({ records: [record] }));
    expect(await screen.findByRole("button", { name: "Cancel Closer for Sam" })).toBeInTheDocument();
  });

  it("ignores a late saved response after moving to another business", async () => {
    const reply = deferred<Response>();
    stubFetch(() => reply.promise);
    const { rerender } = render(<FollowupSchedule businessId="first" records={[]} contacts={contacts} skills={["closer"]} />);
    const user = await openSchedule();
    await fillSchedule(user);
    await user.click(screen.getByRole("button", { name: "Record follow-up" }));
    rerender(<FollowupSchedule businessId="second" records={[]} contacts={[{ id: "another", name: "Jo" }]} skills={["showup"]} />);
    await openSchedule();
    reply.resolve(json({ records: [record] }));
    await waitFor(() => expect(screen.getByText("No follow-ups recorded.")).toBeInTheDocument());
    expect(screen.queryByText("Closer: Sam")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Customer" })).toHaveValue("another");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("asks for a date and time when the due value doesn't parse, and sends nothing", async () => {
    const fetch = stubFetch(() => json({ records: [record] }));
    render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={["closer"]} />);
    const user = await openSchedule();
    await fillSchedule(user);
    const due = screen.getByLabelText("Draft due (your device's local time)");
    fireEvent.change(due, { target: { value: "" } });
    // Submit the form directly: a browser's `required` check would stop an empty value first, but an old browser that shows a text box lets a malformed one through.
    fireEvent.submit(due.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Pick a date and a time for the draft.");
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("in a time zone with daylight saving", () => {
    const zone = process.env.TZ;
    beforeEach(() => { process.env.TZ = "America/New_York"; });
    afterEach(() => { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; });

    it("refuses a time the clocks skip, and sends nothing", async () => {
      // Clocks in New York jump from 2:00 to 3:00 on March 14, 2027, so 2:30 never happens.
      expect(new Date("2027-03-14T02:30").getHours()).toBe(3);
      const fetch = stubFetch(() => json({ records: [record] }));
      render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={["closer"]} />);
      const user = await openSchedule();
      await fillSchedule(user);
      fireEvent.change(screen.getByLabelText("Draft due (your device's local time)"), { target: { value: "2027-03-14T02:30" } });
      await user.click(screen.getByRole("button", { name: "Record follow-up" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("That time is skipped or happens twice when the clocks change.");
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("keeps the saved notice when the refreshed page brings the new record", async () => {
    stubFetch(() => json({ records: [record] }));
    const { rerender } = render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={["closer"]} />);
    const user = await openSchedule();
    await fillSchedule(user);
    await user.click(screen.getByRole("button", { name: "Record follow-up" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Follow-up recorded");
    rerender(<FollowupSchedule businessId="shop" records={[record]} contacts={contacts} skills={["closer"]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Follow-up recorded");
    expect(screen.getByRole("button", { name: "Cancel Closer for Sam" })).toBeVisible();
  });

  it("keeps the disclosure open when refreshed saved records replace its contents", async () => {
    const { rerender } = render(<FollowupSchedule businessId="shop" records={[]} contacts={contacts} skills={["closer"]} />);
    await openSchedule();
    rerender(<FollowupSchedule businessId="shop" records={[record]} contacts={contacts} skills={["closer"]} />);
    expect(screen.getByRole("button", { name: "Cancel Closer for Sam" })).toBeVisible();
    rerender(<FollowupSchedule businessId="shop" records={[{ ...record, evidence: "Updated owner notes.", status: "cancelled" }]} contacts={contacts} skills={["closer"]} />);
    expect(screen.getByText("Canceled")).toBeVisible();
    expect(screen.getByText(/Updated owner notes/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel Closer for Sam" })).not.toBeInTheDocument();
  });
});
