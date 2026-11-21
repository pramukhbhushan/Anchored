import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConnectionsPanel } from "@/components/connections/ConnectionsPanel";
import type { AiKeyView, ConnectionsResponse, ConnectionView } from "@/lib/api/contract";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The services on the Connections page, as an owner uses them: connecting
// texting sends the credentials and shows the number it connected with the
// addresses to paste into Twilio, a service the server can't offer says why
// with no form, a guest sees why they can't connect and no forms, and a
// refused request shows the route's reason. Each service waits on its own
// change, so one answering never frees another's buttons early.

const NO_AI: AiKeyView = { provider: null, lastFour: null, model: null, fallback: "rules", unavailable: null };

const SID = `AC${"a".repeat(32)}`;

/** A service that isn't connected and that this server offers. */
function off(kind: ConnectionView["kind"]): ConnectionView {
  return { kind, connected: false, detail: null, setup: [], unavailable: null };
}

const ALL_OFF: readonly ConnectionView[] = [off("texting"), off("email-out"), off("email-in"), off("stripe")];

/** Return the block for the service named `name`. */
function service(name: string) {
  return within(screen.getByRole("region", { name }));
}

describe("ConnectionsPanel", () => {
  it("connects texting with the owner's Twilio details, then shows the number and the addresses to paste", async () => {
    const texting: ConnectionView = {
      kind: "texting",
      connected: true,
      detail: "+13015550192",
      setup: [
        { label: "When a message comes in", value: "https://anchored.example/api/hooks/twilio/h1/sms" },
        { label: "When a call comes in", value: "https://anchored.example/api/hooks/twilio/h1/voice" },
      ],
      unavailable: null,
    };
    const fetchSpy = stubFetch(() => json({ blocked: null, ai: NO_AI, connections: [texting, ...ALL_OFF.slice(1)], contacts: [] } satisfies ConnectionsResponse));
    render(<ConnectionsPanel businessId="b1" ai={NO_AI} blocked={null} connections={ALL_OFF} />);

    const block = service("Texting and missed calls");
    expect(block.getByText("Not connected")).toBeInTheDocument();
    await userEvent.type(block.getByLabelText("Account SID"), SID);
    await userEvent.type(block.getByLabelText("Auth token"), "token-123");
    await userEvent.type(block.getByLabelText("Twilio number"), "301 555 0192");
    await userEvent.click(block.getByRole("button", { name: "Connect" }));

    expect(sentJson(fetchSpy, 0)).toEqual({
      method: "PUT",
      url: "/api/businesses/b1/connections",
      body: { kind: "texting", accountSid: SID, authToken: "token-123", phone: "301 555 0192" },
    });
    expect(await block.findByText("Connected to +13015550192")).toBeInTheDocument();
    expect(block.getByLabelText("When a message comes in")).toHaveValue("https://anchored.example/api/hooks/twilio/h1/sms");
    expect(block.getByRole("button", { name: "Copy when a call comes in" })).toBeInTheDocument();
    expect(block.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("says what happens to approved messages until each service is connected, and drops it once connected", () => {
    const email: ConnectionView = { kind: "email-out", connected: true, detail: "me@shop.com", setup: [], unavailable: null };
    render(<ConnectionsPanel businessId="b1" ai={NO_AI} blocked={null} connections={[off("texting"), email, off("email-in"), off("stripe")]} />);

    expect(service("Texting and missed calls").getByText(/Until it is, Anchored sends no texts/)).toBeInTheDocument();
    expect(service("Sending email").queryByText(/Until it is/)).not.toBeInTheDocument();
    expect(service("Forwarded email").getByText(/Until it is/)).toBeInTheDocument();
    expect(service("Stripe invoices").getByText(/Until it is/)).toBeInTheDocument();
  });

  it("says why a service isn't offered and shows no form for it", () => {
    const views = ALL_OFF.map((view) => (view.kind === "email-out" ? { ...view, unavailable: "Email sending isn't set up on this server yet." } : view));
    render(<ConnectionsPanel businessId="b1" ai={NO_AI} blocked={null} connections={views} />);

    const block = service("Sending email");
    expect(block.getByText("Email sending isn't set up on this server yet.")).toBeInTheDocument();
    expect(block.queryByLabelText("Reply-to address")).not.toBeInTheDocument();
    expect(block.queryByRole("button")).not.toBeInTheDocument();
  });

  it("tells a guest why they can't connect, once, and shows no forms", () => {
    const reason = "Save your work with an email or Google account first, so the services you connect stay yours.";
    render(<ConnectionsPanel businessId="b1" ai={NO_AI} blocked={reason} connections={ALL_OFF} />);

    expect(screen.getAllByText(reason)).toHaveLength(1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(service("Stripe invoices").getByText("When a Stripe invoice goes unpaid, Payment Nudger drafts a reminder.")).toBeInTheDocument();
  });

  it("shows the route's reason when connecting fails", async () => {
    stubFetch(() => json({ error: "Enter the Twilio number in a form like +1 301 555 0192." }, 400));
    render(<ConnectionsPanel businessId="b1" ai={NO_AI} blocked={null} connections={ALL_OFF} />);

    const block = service("Texting and missed calls");
    await userEvent.type(block.getByLabelText("Account SID"), SID);
    await userEvent.type(block.getByLabelText("Auth token"), "token-123");
    await userEvent.type(block.getByLabelText("Twilio number"), "555");
    await userEvent.click(block.getByRole("button", { name: "Connect" }));

    expect(await block.findByRole("alert")).toHaveTextContent("Enter the Twilio number in a form like +1 301 555 0192.");
    expect(block.getByText("Not connected")).toBeInTheDocument();
  });

  it("keeps a service's button off while its own change is still saving", async () => {
    const forwarding = deferred<Response>();
    const stripe = deferred<Response>();
    stubFetch((_url, init) => (JSON.parse(String(init?.body)).kind === "email-in" ? forwarding.promise : stripe.promise));
    render(<ConnectionsPanel businessId="b1" ai={NO_AI} blocked={null} connections={ALL_OFF} />);

    await userEvent.click(service("Forwarded email").getByRole("button", { name: "Get my forwarding address" }));
    await userEvent.type(service("Stripe invoices").getByLabelText("Signing secret"), "whsec_123");
    await userEvent.click(service("Stripe invoices").getByRole("button", { name: "Connect" }));
    forwarding.resolve(json({ blocked: null, ai: NO_AI, connections: ALL_OFF, contacts: [] } satisfies ConnectionsResponse));

    await waitFor(() => expect(service("Forwarded email").getByRole("button", { name: "Get my forwarding address" })).toBeEnabled());
    expect(service("Stripe invoices").getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("gets a forwarding address with one tap", async () => {
    const address = "abc123+h2@inbound.postmarkapp.com";
    const emailIn: ConnectionView = { kind: "email-in", connected: true, detail: address, setup: [{ label: "Forward customer emails to", value: address }], unavailable: null };
    const fetchSpy = stubFetch(() => json({ blocked: null, ai: NO_AI, connections: [off("texting"), off("email-out"), emailIn, off("stripe")], contacts: [] } satisfies ConnectionsResponse));
    render(<ConnectionsPanel businessId="b1" ai={NO_AI} blocked={null} connections={ALL_OFF} />);

    await userEvent.click(service("Forwarded email").getByRole("button", { name: "Get my forwarding address" }));

    expect(sentJson(fetchSpy, 0).body).toEqual({ kind: "email-in" });
    expect(await service("Forwarded email").findByLabelText("Forward customer emails to")).toHaveValue(address);
  });
});
