import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// What the overview shows a first visitor. The example opens with its four
// stops; an owner's own business doesn't, and its morning brief says the
// waiting drafts are samples until a phone and email are connected. The page
// reads a real in-memory store under a fixed session.

const SESSION = "owner-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));

const { default: OverviewPage } = await import("./page");

/** Render the overview for business `id`. */
async function renderOverview(id: string) {
  render(await OverviewPage({ params: Promise.resolve({ id }) }));
}

/** The morning brief's region. */
function brief(): HTMLElement {
  return screen.getByRole("region", { name: "Morning brief" });
}

beforeEach(async () => {
  stores.current = new MemoryStore();
  await stores.current.saveBusiness(SESSION, hvacShop());
});

describe("Overview page", () => {
  it("says an owner's waiting drafts are samples, with no example tour", async () => {
    await renderOverview(hvacShop().id);

    expect(within(brief()).getByText(/drafts? waits? for you/)).toBeInTheDocument();
    expect(within(brief()).getByText(/These drafts are samples\. Real ones come from your calls, texts and email once you connect them/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Four stops through the example" })).not.toBeInTheDocument();
  });

  it("lists each workflow with who handles it in the owner's words, never a path stamp", async () => {
    await renderOverview(SAMPLE_BUSINESS.id);

    const ledger = screen.getByRole("region", { name: "Your workflows" });
    expect(within(ledger).getByRole("link", { name: /Answer and return calls.*Certus, \$250 a month/ })).toHaveAttribute(
      "href",
      "/app/b/restaurant/workflows#wf-calls",
    );
    expect(within(ledger).getByRole("link", { name: /No-shows and reminders.*Your OpenTable/ })).toBeInTheDocument();
    expect(within(ledger).getByRole("link", { name: /Catering and events.*Anchored drafts, you approve/ })).toBeInTheDocument();
    expect(within(ledger).getByRole("link", { name: /Bookkeeping and invoicing.*Not handled yet/ })).toBeInTheDocument();
    expect(ledger).not.toHaveTextContent(/turn on|\bbuy\b|\bbuild\b|skip/i);
  });

  it("puts no dollar figure on sample drafts and makes no claim about this week", async () => {
    await renderOverview(hvacShop().id);

    expect(brief()).not.toHaveTextContent(/rides on/);
    expect(brief()).not.toHaveTextContent(/this week/i);
  });

  it("totals only the dollars on cards from the owner's own events, and counts the samples beside them", async () => {
    const shop = hvacShop();
    await stores.current!.ensureCards(SESSION, shop.id, [
      {
        // Inbox Triage runs for every business, so its card shows whatever paths the shop picked.
        key: `${shop.id}:event:email-7`,
        agent: "internal",
        skill: "triage",
        title: "Forwarded email: Jo asks about her $400 invoice",
        body: "Hand to Bookkeeping and Invoicing.",
        reason: "You forwarded this email.",
        checks: [],
        action: "Hand off",
        channel: "list",
        stake: 400,
      },
    ]);

    await renderOverview(shop.id);

    expect(within(brief()).getByText("$400 rides on today's cards.")).toBeInTheDocument();
    expect(within(brief()).getByText(/of these drafts are samples/)).toBeInTheDocument();
  });

  it("opens the example with its four stops and no sample line", async () => {
    await renderOverview(SAMPLE_BUSINESS.id);

    expect(screen.getByRole("navigation", { name: "Four stops through the example" })).toBeInTheDocument();
    expect(within(brief()).queryByText(/samples until/)).not.toBeInTheDocument();
  });
});
