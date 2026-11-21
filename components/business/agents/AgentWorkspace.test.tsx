import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cardAnchor } from "@/components/routes";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import { AgentWorkspace } from "./AgentWorkspace";
import { ACTIVE_AGENT_FIXTURES, PENDING_CARD_FIXTURE } from "./fixtures";
import { presentAgents } from "./view-model";

// =============================================================================
// Module Overview
// =============================================================================
// An agent's page shows its waiting drafts and what happened to each decided
// one, and links every draft to its card in Approvals. Nothing on the page
// decides or sends a card.

const AGENTS = presentAgents(ACTIVE_AGENT_FIXTURES);
const CUSTOMER = AGENTS.find((agent) => agent.id === "customer")!;
const BUSINESS_ID = PENDING_CARD_FIXTURE.businessId;

/** Build a uniquely named card for one activity outcome. */
function card(id: string, patch: Partial<CardRecord> = {}): CardRecord {
  return { ...PENDING_CARD_FIXTURE, id, key: `${BUSINESS_ID}:${id}`, title: `Draft ${id}`, example: undefined, status: "approved", ...patch };
}

/** Build a recorded delivery outcome tied to the card's stored identity. */
function entry(source: CardRecord, delivery: OutboxEntry["delivery"], note: string | null = null): OutboxEntry {
  return { id: `outbox-${source.id}`, cardId: source.id, businessId: BUSINESS_ID, channel: "email", to: "Sam", body: source.body, sentAt: "2026-11-08T15:00:00Z", delivery, note };
}

describe("AgentWorkspace", () => {
  it("shows an example draft and links its stable key into the single approval queue", () => {
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={CUSTOMER} cards={[PENDING_CARD_FIXTURE]} outbox={[]} />);
    const waiting = screen.getByRole("region", { name: "Waiting for your OK" });
    expect(within(waiting).getByText("Example")).toBeInTheDocument();
    expect(within(waiting).getByRole("heading", { name: PENDING_CARD_FIXTURE.title })).toBeInTheDocument();
    expect(within(waiting).getByText(PENDING_CARD_FIXTURE.body)).toBeInTheDocument();
    expect(within(waiting).getByRole("link", { name: "Review in Approvals" })).toHaveAttribute("href", `/app/b/${BUSINESS_ID}/approvals#${cardAnchor(PENDING_CARD_FIXTURE.key)}`);
    expect(screen.queryByRole("button", { name: /approve|send|edit|skip/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workflows" })).toHaveAttribute("href", `/app/b/${BUSINESS_ID}/workflows`);
  });

  it("keeps empty activity distinct from work waiting for approval", () => {
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={CUSTOMER} cards={[]} outbox={[]} />);
    expect(within(screen.getByRole("region", { name: "Waiting for your OK" })).getByText(/Nothing waits for you here/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Recent activity" })).getByText("No decisions yet.")).toBeInTheDocument();
    expect(screen.queryByText("Sent by Anchored")).not.toBeInTheDocument();
  });

  it("distinguishes sent, queued, failed, skipped and replaced work", () => {
    const sent = card("sent");
    const queued = card("queued");
    const failed = card("failed");
    const skipped = card("skipped", { status: "skipped" });
    const replaced = card("replaced", { status: "superseded" });
    const approved = card("approved");
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={CUSTOMER} cards={[sent, queued, failed, skipped, replaced, approved]} outbox={[entry(sent, "sent"), entry(queued, "queued", "Quiet hours: waits until 8 a.m."), entry(failed, "failed", "Check the connection.")]} />);
    const recent = screen.getByRole("region", { name: "Recent activity" });
    expect(within(recent).getByText("Sent by Anchored")).toBeInTheDocument();
    expect(within(recent).getByText("Quiet hours: waits until 8 a.m.")).toBeInTheDocument();
    expect(within(recent).getByText("Didn't send: Check the connection.")).toBeInTheDocument();
    expect(within(recent).getByText("Skipped")).toBeInTheDocument();
    expect(within(recent).getByText("Replaced by a newer draft")).toBeInTheDocument();
    expect(within(recent).getByText("Approved. See your outbox for delivery details.")).toBeInTheDocument();
    expect(within(recent).getByRole("link", { name: "Draft queued" })).toHaveAttribute("href", `/app/b/${BUSINESS_ID}/approvals#${cardAnchor(queued.key)}`);
  });

  it("doesn't call locked or flag-card decisions customer sends", () => {
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={CUSTOMER} cards={[card("locked", { channel: "locked" }), card("flag", { channel: "flag" })]} outbox={[]} />);
    expect(screen.getByText("Yours to handle")).toBeInTheDocument();
    expect(screen.getByText("Fact noted")).toBeInTheDocument();
    expect(screen.queryByText("Sent by Anchored")).not.toBeInTheDocument();
  });

  it("shows limits and enabled skill jobs in the secondary disclosure", () => {
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={CUSTOMER} cards={[]} outbox={[]} />);
    const summary = screen.getByText("What Customer handles");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    for (const limit of CUSTOMER.never) expect(within(details!).getByText(limit)).toBeInTheDocument();
    expect(within(details!).getByRole("heading", { name: "It never" })).toBeInTheDocument();
  });

  it("preserves an active niche agent's name and job", () => {
    const niche = AGENTS.find((agent) => agent.niche)!;
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={niche} cards={[]} outbox={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: niche.name })).toBeInTheDocument();
    expect(screen.getByText(niche.job)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: `Ask ${niche.name}` })).toBeInTheDocument();
  });

  it("points to Chat when the page passes no Ask panel", () => {
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={CUSTOMER} cards={[]} outbox={[]} />);
    const ask = screen.getByRole("region", { name: "Ask Customer" });
    expect(within(ask).getByText(/For now, ask Anchored for a draft in Chat/)).toBeInTheDocument();
    expect(within(ask).getByRole("link", { name: "Open Chat" })).toHaveAttribute("href", `/app/b/${BUSINESS_ID}/chat`);
  });

  it("accepts an available Ask view and a separate customer-thread slot", () => {
    render(<AgentWorkspace businessId={BUSINESS_ID} agent={CUSTOMER} cards={[]} outbox={[]} ask={<label>Request a Customer draft<textarea /></label>}><section aria-label="Customer conversations">Sam's messages</section></AgentWorkspace>);
    expect(within(screen.getByRole("region", { name: "Ask Customer" })).getByRole("textbox", { name: "Request a Customer draft" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Customer conversations" })).toHaveTextContent("Sam's messages");
  });
});
