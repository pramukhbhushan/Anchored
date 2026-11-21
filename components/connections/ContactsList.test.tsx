import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ContactsList } from "@/components/connections/ContactsList";
import type { AiKeyView, ConnectionsResponse } from "@/lib/api/contract";
import type { Contact } from "@/lib/domain/contacts";
import { json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The customer list on the Connections page: each customer shows where their
// texting OK came from, or that there is none, and a STOP on file. Adding a
// customer sends their details and shows them in the list; Remove deletes one.

const NO_AI: AiKeyView = { provider: null, lastFour: null, model: null, unavailable: null };

const DANA: Contact = {
  id: "c1",
  businessId: "b1",
  name: "Dana Lewis",
  phone: "+14105550137",
  email: null,
  consent: { source: "in-person", at: "2026-11-07T15:00:00Z" },
  optedOutAt: null,
};

const SAM: Contact = { id: "c2", businessId: "b1", name: "Sam Ortiz", phone: "+13015550100", email: "sam@example.com", consent: null, optedOutAt: "2026-11-07T16:00:00Z" };

/** The route's answer with `contacts`. */
function answer(contacts: readonly Contact[]): Response {
  return json({ blocked: null, ai: NO_AI, connections: [], contacts } satisfies ConnectionsResponse);
}

describe("ContactsList", () => {
  it("shows where each customer's texting OK came from, and a STOP on file", () => {
    render(<ContactsList businessId="b1" canChange contacts={[DANA, SAM]} />);

    expect(screen.getByText("Anchored texts only customers with an OK on file. Anyone who texts STOP is never texted again.")).toBeInTheDocument();
    const dana = within(screen.getByRole("row", { name: /Dana Lewis/ }));
    expect(dana.getByText("Said yes in person")).toBeInTheDocument();
    const sam = within(screen.getByRole("row", { name: /Sam Ortiz/ }));
    expect(sam.getByText("No texting OK on file")).toBeInTheDocument();
    expect(sam.getByText("Texted STOP")).toBeInTheDocument();
  });

  it("adds a customer and shows them in the list", async () => {
    const fetchSpy = stubFetch(() => answer([DANA]));
    render(<ContactsList businessId="b1" canChange contacts={[]} />);

    await userEvent.type(screen.getByLabelText("Name"), "Dana Lewis");
    await userEvent.type(screen.getByLabelText("Phone"), "(410) 555-0137");
    await userEvent.selectOptions(screen.getByLabelText("Texting OK"), "Said yes in person");
    await userEvent.click(screen.getByRole("button", { name: "Add customer" }));

    expect(sentJson(fetchSpy, 0)).toEqual({
      method: "POST",
      url: "/api/businesses/b1/contacts",
      body: { name: "Dana Lewis", phone: "(410) 555-0137", consent: "in-person" },
    });
    expect(await screen.findByRole("row", { name: /Dana Lewis/ })).toBeInTheDocument();
  });

  it("removes a customer", async () => {
    const fetchSpy = stubFetch(() => answer([SAM]));
    render(<ContactsList businessId="b1" canChange contacts={[DANA, SAM]} />);

    await userEvent.click(screen.getByRole("button", { name: "Remove Dana Lewis" }));

    expect(sentJson(fetchSpy, 0)).toMatchObject({ method: "DELETE", url: "/api/businesses/b1/contacts/c1" });
    expect(await screen.findByRole("button", { name: "Remove Sam Ortiz" })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Dana Lewis/ })).not.toBeInTheDocument();
  });

  it("shows the route's reason when a customer can't be added", async () => {
    stubFetch(() => json({ error: "Enter the phone number in a form like (301) 555-0192." }, 400));
    render(<ContactsList businessId="b1" canChange contacts={[]} />);

    await userEvent.type(screen.getByLabelText("Name"), "Dana");
    await userEvent.type(screen.getByLabelText("Phone"), "call me");
    await userEvent.click(screen.getByRole("button", { name: "Add customer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the phone number in a form like (301) 555-0192.");
  });

  it("offers no changes to a visitor who can't make them", () => {
    render(<ContactsList businessId="b1" canChange={false} contacts={[DANA]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add a customer" })).not.toBeInTheDocument();
  });
});
