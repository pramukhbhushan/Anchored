import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setLocation } from "@/test/next";
import { CustomerThreads, type CustomerThreadsData, type ThreadContact, type ThreadMessage } from "./CustomerThreads";

// =============================================================================
// Module Overview
// =============================================================================
// Exercises customer selection, safety states and read-only message history.
// The owner should always know whether a reply is waiting or sent, and a failed
// conversation read must not masquerade as a successfully empty conversation.

const CONTACTS: readonly ThreadContact[] = [
  { id: "sam & family", name: "Sam's family", lastText: "Is the shop open?", lastAt: "2026-11-08T15:00:00.000Z", stopped: false, locked: false },
  { id: "maria", name: "María", stopped: true, locked: true },
];

const MESSAGES: readonly ThreadMessage[] = [
  { id: "in-1", direction: "in", text: "Is the shop open?", at: "2026-11-08T15:00:00.000Z" },
  { id: "out-1", direction: "out", text: "Yes, we're open.", at: "2026-11-08T15:01:00.000Z", delivery: "queued", note: "Quiet hours: this reply waits until 8 a.m.", cardKey: "example:inquiry" },
  { id: "out-2", direction: "out", text: "Thanks for checking.", at: "2026-11-08T15:02:00.000Z", delivery: "sent" },
];

function data(overrides: Partial<CustomerThreadsData> = {}): CustomerThreadsData {
  return { contacts: CONTACTS, selectedContactId: CONTACTS[0]?.id ?? null, messages: MESSAGES, ...overrides };
}

describe("CustomerThreads", () => {
  it("links to customers while preserving unrelated query parameters", () => {
    setLocation({ search: "contact=old&filter=recent&tag=a&tag=b" });
    render(<CustomerThreads businessId="my shop" data={data()} />);

    const customerNav = screen.getByRole("navigation", { name: "Customers" });
    const sam = within(customerNav).getByRole("link", { name: /Sam's family/ });
    const maria = within(customerNav).getByRole("link", { name: "María" });
    expect(sam).toHaveAttribute("href", "/app/b/my%20shop/workflows/customer?contact=sam+%26+family&filter=recent&tag=a&tag=b");
    expect(sam).toHaveAttribute("aria-current", "true");
    expect(maria).toHaveAttribute("href", "/app/b/my%20shop/workflows/customer?contact=maria&filter=recent&tag=a&tag=b");
    expect(maria).not.toHaveAttribute("aria-current");
  });

  it("shows the supplied message order, direction and actual delivery status", () => {
    render(<CustomerThreads businessId="example" data={data()} />);

    const messages = within(screen.getByRole("list", { name: "Messages with Sam's family" })).getAllByRole("listitem");
    expect(messages).toHaveLength(3);
    expect(messages[0]).toHaveTextContent("From customer");
    expect(messages[0]).toHaveTextContent("Is the shop open?");
    expect(messages[1]).toHaveTextContent("From business");
    expect(messages[1]).toHaveTextContent("Waiting to send");
    expect(messages[1]).not.toHaveTextContent("Sent");
    expect(messages[1]).toHaveTextContent("Quiet hours: this reply waits until 8 a.m.");
    expect(messages[2]).toHaveTextContent("Sent");
    expect(screen.getByRole("link", { name: "See card in Approvals" })).toHaveAttribute("href", "/app/b/example/approvals#card-example-inquiry");
  });

  it("escapes customer text rather than interpreting HTML, and offers no direct-send composer", () => {
    const text = '<img src=x onerror="alert(1)">\n<script>private()</script>';
    render(<CustomerThreads businessId="example" data={data({ messages: [{ id: "unsafe", direction: "in", text, at: "2026-11-08T15:00:00Z" }] })} />);

    const conversation = screen.getByRole("region", { name: "Conversation with Sam's family" });
    expect(conversation.textContent).toContain(text);
    expect(conversation.querySelector("img,script")).toBeNull();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });

  it("shows STOP and allergy-lock states without offering a bypass", () => {
    render(<CustomerThreads businessId="example" data={data({ selectedContactId: "maria", messages: [] })} />);

    const conversation = screen.getByRole("region", { name: "Conversation with María" });
    expect(conversation).toHaveTextContent("Messages stopped. Anchored won't message this customer.");
    expect(conversation).toHaveTextContent("Allergy question. This conversation is locked for you to handle.");
    expect(within(conversation).queryByRole("button")).not.toBeInTheDocument();
  });

  it("distinguishes no customers, no selection, a missing customer and no messages", () => {
    const { rerender } = render(<CustomerThreads businessId="example" data={data({ contacts: [], selectedContactId: null, messages: [] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("No customer conversations yet.");

    rerender(<CustomerThreads businessId="example" data={data({ selectedContactId: null })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Choose a customer to read their messages.");

    rerender(<CustomerThreads businessId="example" data={data({ selectedContactId: "removed" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("This customer is no longer in the list. Choose another customer.");
    expect(screen.queryByText("Yes, we're open.")).not.toBeInTheDocument();

    rerender(<CustomerThreads businessId="example" data={data({ messages: [] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("No messages in this conversation yet.");
  });

  it("shows unavailable data honestly instead of a successful empty state", () => {
    render(<CustomerThreads businessId="example" data={data({ unavailableReason: "Customer conversations couldn't load. Try again." })} />);

    expect(screen.getByRole("status")).toHaveTextContent("Customer conversations couldn't load. Try again.");
    expect(screen.queryByText("No customer conversations yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Customers" })).not.toBeInTheDocument();
    expect(screen.queryByText("Yes, we're open.")).not.toBeInTheDocument();
  });

  it("lets the caller refresh and prevents repeated refreshes while loading", async () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<CustomerThreads businessId="example" data={data()} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh conversations" }));
    expect(onRefresh).toHaveBeenCalledOnce();

    rerender(<CustomerThreads businessId="example" data={data()} onRefresh={onRefresh} pending />);
    expect(screen.getByRole("button", { name: "Refreshing conversations..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Loading messages...");
    expect(screen.queryByText("Yes, we're open.")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Customer conversations" })).toHaveAttribute("aria-busy", "true");
  });

  it("renders unknown dates without crashing and distinguishes failed sends", () => {
    render(<CustomerThreads businessId="example" data={data({ messages: [{ id: "failed", direction: "out", text: "A reply that did not send", at: "bad-date", delivery: "failed", note: "Connection unavailable" }] })} />);
    const conversation = screen.getByRole("region", { name: "Conversation with Sam's family" });
    expect(conversation).toHaveTextContent("Time unavailable");
    expect(conversation).toHaveTextContent("Didn't send");
    expect(conversation).toHaveTextContent("Connection unavailable");
  });
});
