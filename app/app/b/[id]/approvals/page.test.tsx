import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// What the Approvals page tells a visitor about the cards on it. An owner's
// own business has no live connector yet, so the page says its cards are
// samples; the example business says how approving works instead, and is the
// only one that offers to watch an agent draft. Each approved text in the
// outbox opens the owner's own texting app, except one quiet hours still hold.
// The page reads a real in-memory store under a fixed session.

const SESSION = "owner-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));

const { default: ApprovalsPage } = await import("./page");

/** Render the Approvals page for business `id`. */
async function renderApprovals(id: string) {
  render(await ApprovalsPage({ params: Promise.resolve({ id }) }));
}

beforeEach(async () => {
  stores.current = new MemoryStore();
  await stores.current.saveBusiness(SESSION, hvacShop());
});

describe("Approvals page", () => {
  it("tells an owner the cards are samples and that nothing goes out without approval", async () => {
    await renderApprovals(hvacShop().id);

    expect(screen.getByText("Sample drafts from your agents. Nothing goes out until you approve it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch an agent draft" })).not.toBeInTheDocument();
  });

  it("tells a visitor to the example how approving works, and offers to watch an agent draft", async () => {
    await renderApprovals(SAMPLE_BUSINESS.id);

    expect(screen.getByText("Agents draft each text, email and post. Nothing goes out until you approve it.")).toBeInTheDocument();
    expect(screen.queryByText(/Sample drafts/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watch an agent draft" })).toBeInTheDocument();
  });

  it("offers to send an approved text from the owner's phone", async () => {
    const body = "Sorry we missed you. Reply STOP to opt out.";
    await stores.current?.addOutbox(SESSION, { businessId: hvacShop().id, cardId: "card-1", channel: "sms", to: "(410) 555-0137", body, sentAt: "2026-11-07T15:00:00Z" });

    await renderApprovals(hvacShop().id);

    const outbox = screen.getByRole("complementary", { name: "Outbox" });
    expect(within(outbox).getByText("You send each one yourself")).toBeInTheDocument();
    expect(within(outbox).getByRole("link", { name: "Send from your phone" })).toHaveAttribute("href", `sms:4105550137?&body=${encodeURIComponent(body)}`);
  });

  it("holds back the send link on a text that quiet hours still hold", async () => {
    const later = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await stores.current?.addOutbox(SESSION, { businessId: hvacShop().id, cardId: "card-1", channel: "sms", to: "Dana Lewis", body: "Hi Dana. Reply STOP to opt out.", sentAt: later });

    await renderApprovals(hvacShop().id);

    const outbox = screen.getByRole("complementary", { name: "Outbox" });
    expect(within(outbox).getByText(/^Ready to send at/)).toBeInTheDocument();
    expect(within(outbox).queryByRole("link", { name: "Send from your phone" })).not.toBeInTheDocument();
  });
});
