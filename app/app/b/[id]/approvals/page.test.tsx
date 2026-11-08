import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { businessHref, cardAnchor } from "@/components/routes";
import type { ApprovedDraft } from "@/components/business/handoff";
import type { OutboxEntry } from "@/lib/api/contract";
import { draftFeed } from "@/lib/domain/cards";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { resolveChoices } from "@/lib/domain/paths";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// What the Approvals page tells a visitor about the cards on it. An owner's
// starters are tagged as examples, and once they are done with nothing
// connected the page points to Connections; the example business says how
// approving works instead, and is the only one that offers to watch an agent
// draft. Each approved text in the
// outbox opens the owner's own texting app, except one quiet hours still hold
// and one Anchored sent itself. A text that failed says why and offers the
// owner's texting app, and one Anchored left for the owner says why.
// The page reads a real in-memory store under a fixed session.

const SESSION = "owner-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));

const futureOutbox = vi.hoisted(() => new Array<Omit<OutboxEntry, "channel"> & Pick<ApprovedDraft, "channel">>());
vi.mock("@/lib/server/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/data")>();
  return {
    ...actual,
    getFeed: async (...args: Parameters<typeof actual.getFeed>) => {
      const feed = await actual.getFeed(...args);
      return { ...feed, outbox: [...feed.outbox, ...futureOutbox] };
    },
  };
});

const { default: ApprovalsPage } = await import("./page");

/** Render the Approvals page for business `id`. */
async function renderApprovals(id: string) {
  render(await ApprovalsPage({ params: Promise.resolve({ id }) }));
}

beforeEach(async () => {
  futureOutbox.length = 0;
  stores.current = new MemoryStore();
  await stores.current.saveBusiness(SESSION, hvacShop());
});

describe("Approvals page", () => {
  it("tells an owner the cards are examples and that nothing goes out without approval", async () => {
    await renderApprovals(hvacShop().id);

    expect(screen.getByText("Example drafts from your agents. Nothing goes out until you approve it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch an agent draft" })).not.toBeInTheDocument();
  });

  it("tells a visitor to the example how approving works, and offers to watch an agent draft", async () => {
    await renderApprovals(SAMPLE_BUSINESS.id);

    expect(screen.getByText("Agents draft each text, email and post. Nothing goes out until you approve it.")).toBeInTheDocument();
    expect(screen.queryByText(/Example drafts/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watch an agent draft" })).toBeInTheDocument();
  });

  it("shows a sent Telegram message without a personal-app send action", async () => {
    futureOutbox.push({ id: "tg-1", businessId: hvacShop().id, cardId: "card-tg", channel: "telegram", to: "Dana Lewis", body: "Thanks, Dana. Your quote is ready.", sentAt: "2026-11-07T15:00:00Z", delivery: "sent", note: null });

    await renderApprovals(hvacShop().id);

    const outbox = screen.getByRole("complementary", { name: "Outbox" });
    expect(within(outbox).getByText("Telegram message to Dana Lewis")).toBeInTheDocument();
    expect(outbox).toHaveTextContent("Thanks, Dana. Your quote is ready.");
    expect(within(outbox).getByText("Sent by Anchored")).toBeInTheDocument();
    expect(within(outbox).queryByRole("link", { name: /Send from/ })).not.toBeInTheDocument();
  });

  it("points a failed Telegram message to Connections instead of a manual send bypass", async () => {
    futureOutbox.push({ id: "tg-2", businessId: hvacShop().id, cardId: "card-tg", channel: "telegram", to: "Dana Lewis", body: "Thanks, Dana.", sentAt: "2026-11-07T15:00:00Z", delivery: "failed", note: "The bot could not reach this chat." });

    await renderApprovals(hvacShop().id);

    const outbox = screen.getByRole("complementary", { name: "Outbox" });
    expect(outbox).toHaveTextContent("Didn't send: The bot could not reach this chat. Check the Telegram connection.");
    expect(within(outbox).getByRole("link", { name: "See connections" })).toHaveAttribute("href", businessHref(hvacShop().id, "connections"));
    expect(within(outbox).queryByRole("link", { name: /Send from/ })).not.toBeInTheDocument();
    expect(within(outbox).queryByRole("button", { name: /Copy/ })).not.toBeInTheDocument();
    expect(outbox).not.toHaveTextContent("Send it yourself");
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

  it("says Anchored sent a text through a connected number, with no send step for the owner", async () => {
    await stores.current?.addOutbox(SESSION, { businessId: hvacShop().id, cardId: "card-1", channel: "sms", to: "+14105550137", body: "Hi Dana. Reply STOP to opt out.", sentAt: "2026-11-07T15:00:00Z", delivery: "sent" });

    await renderApprovals(hvacShop().id);

    const outbox = screen.getByRole("complementary", { name: "Outbox" });
    expect(within(outbox).getByText("Anchored sends what it can")).toBeInTheDocument();
    expect(within(outbox).getByText("Sent by Anchored")).toBeInTheDocument();
    expect(within(outbox).queryByRole("link", { name: "Send from your phone" })).not.toBeInTheDocument();
  });

  it("says why a text didn't send and offers to send it from the owner's phone", async () => {
    const body = "Hi Dana. Reply STOP to opt out.";
    await stores.current?.addOutbox(SESSION, {
      businessId: hvacShop().id,
      cardId: "card-1",
      channel: "sms",
      to: "+14105550137",
      body,
      sentAt: "2026-11-07T15:00:00Z",
      delivery: "failed",
      note: "Twilio refused the number.",
    });

    await renderApprovals(hvacShop().id);

    const outbox = screen.getByRole("complementary", { name: "Outbox" });
    expect(within(outbox).getByText("Didn't send: Twilio refused the number.")).toBeInTheDocument();
    expect(within(outbox).getByRole("link", { name: "Send from your phone" })).toHaveAttribute("href", `sms:+14105550137?&body=${encodeURIComponent(body)}`);
  });

  it("says why Anchored left a text for the owner to send", async () => {
    const note = "No texting OK on file for this number. Add it in Connections, or send it from your phone.";
    await stores.current?.addOutbox(SESSION, { businessId: hvacShop().id, cardId: "card-1", channel: "sms", to: "(410) 555-0137", body: "Hi. Reply STOP to opt out.", sentAt: "2026-11-07T15:00:00Z", delivery: "yours", note });

    await renderApprovals(hvacShop().id);

    const outbox = screen.getByRole("complementary", { name: "Outbox" });
    expect(within(outbox).getByText("You send each one yourself")).toBeInTheDocument();
    expect(within(outbox).getByText(note)).toBeInTheDocument();
    expect(within(outbox).getByRole("link", { name: "Send from your phone" })).toBeInTheDocument();
  });
});

describe("Approvals history links", () => {
  it.each(["approved", "skipped"] as const)("reveals the %s card named by a deep link", async (status) => {
    const shop = hvacShop();
    const draft = draftFeed(shop, resolveChoices(shop, {}))[0];
    if (draft === undefined) throw new Error("Expected an example draft");
    await stores.current!.ensureCards(SESSION, shop.id, [draft]);
    const card = (await stores.current!.listCards(SESSION, shop.id))[0];
    if (card === undefined) throw new Error("Expected the stored card");
    await stores.current!.updateCard(SESSION, card.id, { status, decidedAt: "2026-11-07T15:00:00Z" });
    const previousUrl = window.location.href;
    try {
      window.history.replaceState(null, "", `#${cardAnchor(card.key)}`);

      await renderApprovals(shop.id);

      const target = document.getElementById(cardAnchor(card.key));
      expect(target).toHaveTextContent(card.title);
      expect(target?.closest("details")).toHaveAttribute("open");
      expect(target).toHaveTextContent(status === "skipped" ? "Skipped" : "Approved");
    } finally {
      window.history.replaceState(null, "", previousUrl);
    }
  });
});

describe("Approvals page examples", () => {
  /** Skip every draft in the feed, as an owner clearing the examples would. */
  async function skipEveryDraft() {
    const shop = hvacShop();
    const drafts = draftFeed(shop, resolveChoices(shop, {}));
    await stores.current!.ensureCards(SESSION, shop.id, drafts);
    for (const card of await stores.current!.listCards(SESSION, shop.id)) {
      await stores.current!.updateCard(SESSION, card.id, { status: "skipped", decidedAt: "2026-11-07T15:00:00Z" });
    }
  }

  it("tags each starter card as an example", async () => {
    await renderApprovals(hvacShop().id);

    const waiting = screen.getAllByRole("article");
    expect(waiting.length).toBeGreaterThan(1);
    for (const card of waiting) expect(within(card).getByText("Example")).toBeInTheDocument();
  });

  it("leaves the example business's researched cards untagged", async () => {
    await renderApprovals(SAMPLE_BUSINESS.id);

    expect(screen.queryByText("Example")).not.toBeInTheDocument();
  });

  it("points an owner with no examples left and nothing connected to Connections", async () => {
    await skipEveryDraft();

    await renderApprovals(hvacShop().id);

    expect(screen.getByRole("heading", { name: "Connect a phone or inbox to see real drafts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up a connection" })).toHaveAttribute("href", businessHref(hvacShop().id, "connections"));
    expect(screen.queryByText(/Example drafts/)).not.toBeInTheDocument();
  });

  it("tells a connected owner with nothing waiting that new drafts land here", async () => {
    await skipEveryDraft();
    await stores.current!.saveConnection(SESSION, { businessId: hvacShop().id, kind: "texting", hookId: "hook-1", settings: {}, secret: null });

    await renderApprovals(hvacShop().id);

    expect(screen.getByRole("heading", { name: "You're all caught up" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Set up a connection" })).not.toBeInTheDocument();
  });
});
