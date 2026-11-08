import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { deferred, json, sentJson, stubFetch } from "@/test/http";
import { router } from "@/test/next";
import type { RecordedFollowup } from "@/lib/domain/followups";
import { FollowupSchedule } from "./FollowupSchedule";

// =============================================================================
// Module Overview
// =============================================================================
// The schedule records owner-confirmed facts through the real fetch boundary.
// Tests verify request identities and dates, failure recovery, saved results,
// duplicate guards and isolation when an earlier business's reply arrives late.

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
    expect(screen.getByText(/scheduled sender must be running/)).toBeInTheDocument();
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

  it("cancels by stored identity and keeps the authoritative canceled record", async () => {
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
