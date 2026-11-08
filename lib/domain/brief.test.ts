import { describe, expect, it } from "vitest";
import { briefLines, briefSnapshot, morningBrief, type SnapshotCard } from "@/lib/domain/brief";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the morning brief lines the owner reads first. Dollars never come
// from an example card, whose figures are made up to show the card.

describe("morningBrief", () => {
  const hvac = hvacShop();

  it("leads with what waits, then what rides on it, new workflows and the stack cost", () => {
    const lines = morningBrief(hvac, {}, [
      { status: "pending", title: "Quote to the Okafors", stake: 11400 },
      { status: "pending", title: "Plan renewals", stake: 2800 },
      { status: "approved", title: "Missed call", stake: 500 },
    ]);
    expect(lines).toEqual([
      "2 cards wait for you. First up: Quote to the Okafors.",
      "$14,200 in quotes, invoices or orders rides on today's cards.",
      "New for you: Social posts and marketing.",
      "Your stack costs $29 a month.",
    ]);
  });

  it("puts no dollar figure on an owner's example drafts", () => {
    const lines = morningBrief(hvac, {}, [{ status: "pending", title: "Invoice 1042 is 9 days late", stake: 240, example: true }]);
    expect(lines.join(" ")).not.toContain("rides on");
  });

  it("counts the example business's researched dollars", () => {
    const lines = morningBrief(SAMPLE_BUSINESS, {}, [{ status: "pending", title: "Party of 40", stake: 1200 }]);
    expect(lines).toContain("$1,200 in quotes, invoices or orders rides on today's cards.");
  });

  it("says so when every card is decided, and names quote-only tools", () => {
    const lines = morningBrief(hvac, { leads: { path: "buy", toolId: "housecall" } }, [{ status: "skipped", title: "Old card" }]);
    expect(lines[0]).toBe("Nothing waits for you. Every card is decided.");
    expect(lines.at(-1)).toBe("Your stack costs $29 a month, plus Housecall Pro on quote.");
  });
});

describe("briefSnapshot and briefLines", () => {
  const card = (over: Partial<SnapshotCard> = {}): SnapshotCard => ({
    key: Math.random().toString(),
    title: "A card",
    status: "pending",
    channel: "telegram",
    skill: "inquiry",
    createdAt: "2026-11-08T12:00:00Z",
    ...over,
  });
  const NOW = "2026-11-08T15:00:00Z";

  it("ranks the waiting cards by dollars, leaves example dollars out and never cuts a flag", () => {
    const snapshot = briefSnapshot({
      cards: [
        card({ title: "Small quote", stake: 120 }),
        card({ title: "Big quote", stake: 900 }),
        card({ title: "Example order", stake: 5000, example: true }),
        card({ title: "Allergy question from Sam", channel: "locked" }),
        card({ title: "Billing question from Dana", channel: "flag" }),
        card({ title: "Decided", status: "approved", stake: 300 }),
      ],
      outbox: [],
      optedOutAt: [],
      since: null,
      now: NOW,
    });
    expect(snapshot).toMatchObject({ waiting: 5, waitingStake: 1020, examplesWaiting: 1, flags: ["Allergy question from Sam", "Billing question from Dana"] });
    expect(snapshot.top.map((t) => t.title)).toEqual(["Big quote", "Small quote", "Allergy question from Sam"]);
    const lines = briefLines(snapshot);
    expect(lines[0]).toBe("2 need you personally: Allergy question from Sam; Billing question from Dana.");
    expect(lines[1]).toBe("5 drafts wait for your OK, worth about $1,020. Start with: Big quote.");
    expect(lines.join(" ")).not.toContain("5,000");
  });

  it("counts sends, new drafts and stops only since the last brief", () => {
    const snapshot = briefSnapshot({
      cards: [card({ createdAt: "2026-11-08T09:00:00Z" }), card({ createdAt: "2026-11-08T13:00:00Z" })],
      outbox: [
        { delivery: "sent", channel: "telegram", sentAt: "2026-11-08T09:30:00Z" },
        { delivery: "sent", channel: "telegram", sentAt: "2026-11-08T13:30:00Z" },
        { delivery: "failed", channel: "telegram", sentAt: "2026-11-08T14:00:00Z" },
        { delivery: "queued", channel: "telegram", sentAt: "2026-11-09T13:00:00Z" },
      ],
      optedOutAt: ["2026-11-08T09:00:00Z", "2026-11-08T14:30:00Z", null],
      since: "2026-11-08T12:00:00Z",
      now: NOW,
    });
    expect(snapshot).toMatchObject({ newCards: 1, sent: 1, failed: 1, queued: 1, stops: 1 });
    expect(briefLines(snapshot)).toContain("Since your last brief: 1 new draft, 1 sent, 1 failed to send, 1 customer asked to stop getting messages.");
  });

  it("leaves earlier brief cards out of every count", () => {
    const snapshot = briefSnapshot({ cards: [card({ skill: "brief", channel: "flag", title: "Your brief" })], outbox: [], optedOutAt: [], since: null, now: NOW });
    expect(snapshot).toMatchObject({ waiting: 0, flags: [], newCards: 0 });
    expect(briefLines(snapshot)).toEqual(["Nothing waits for your OK.", "So far: nothing new."]);
  });
});
