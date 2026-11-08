import { beforeEach, describe, expect, it } from "vitest";
import type { CardRecord } from "@/lib/api/contract";
import { profileFromFacts } from "@/lib/domain/engine";
import type { KeyedCard } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";
import { decideCard } from "./decide";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `decideCard`: what an owner's tap sends, queues or refuses, as
// seen through the store's cards and outbox.

const SESSION = "test-session";
const BUSINESS = "b_test";

// November dates are Eastern Standard Time, UTC-5.
const TEN_AM_EASTERN = new Date("2026-11-09T15:00:00Z");
const NINE_PM_EASTERN = new Date("2026-11-10T02:00:00Z");
const NEXT_EIGHT_AM_EASTERN = "2026-11-10T13:00:00.000Z";

const missedCallText: KeyedCard = {
  key: `${BUSINESS}:callback`,
  agent: "frontdesk",
  skill: "callback",
  title: "Missed call at 7:42 p.m.",
  body: "Sorry we missed you, this is College Park Heating & Air. Reply STOP to opt out.",
  reason: "Callers who wait often book the next shop.",
  checks: ["The caller reached out first"],
  action: "Send text",
  channel: "sms",
  to: "(301) 555-0192",
};

let store: MemoryStore;

async function addCard(card: KeyedCard): Promise<CardRecord> {
  await store.ensureCards(SESSION, BUSINESS, [card]);
  const saved = (await store.listCards(SESSION, BUSINESS)).find((record) => record.key === card.key);
  if (!saved) throw new Error("test setup: card was not stored");
  return saved;
}

beforeEach(() => {
  store = new MemoryStore();
});

describe("decideCard", () => {
  it("sends an approved text right away during the day", async () => {
    const card = await addCard(missedCallText);
    const result = await decideCard(store, SESSION, card, { decision: "approve" }, TEN_AM_EASTERN);

    expect(result.ok).toBe(true);
    const outbox = await store.listOutbox(SESSION, BUSINESS);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.body).toBe(missedCallText.body);
    expect(outbox[0]?.sentAt).toBe(TEN_AM_EASTERN.toISOString());
    expect((await store.getCard(SESSION, card.id))?.status).toBe("approved");
  });

  it("queues a text approved during quiet hours for 8 a.m. instead of sending it", async () => {
    const card = await addCard(missedCallText);
    const result = await decideCard(store, SESSION, card, { decision: "approve" }, NINE_PM_EASTERN);

    expect(result.ok && result.response.blocked).toMatch(/Queued for/);
    const outbox = await store.listOutbox(SESSION, BUSINESS);
    expect(outbox[0]?.sentAt).toBe(NEXT_EIGHT_AM_EASTERN);
  });

  it("sends the owner's edited body and marks the card edited", async () => {
    const card = await addCard(missedCallText);
    const edited = "Hi, sorry we missed you. Reply STOP to opt out.";
    await decideCard(store, SESSION, card, { decision: "approve", body: edited }, TEN_AM_EASTERN);

    expect((await store.listOutbox(SESSION, BUSINESS))[0]?.body).toBe(edited);
    expect((await store.getCard(SESSION, card.id))?.edited).toBe(true);
  });

  it("logs the owner's edited post text when a copy-post card is approved", async () => {
    const card = await addCard({
      key: `${BUSINESS}:posts`,
      agent: "content",
      skill: "posts",
      title: "Your Google listing hasn't changed in 3 months",
      body: 'Draft post for Linden Street Kitchen: "Stop by this week."',
      reason: "Customers skip a business when basic details are missing.",
      checks: ["You post it yourself"],
      action: "Copy post",
      channel: "list",
    });
    const edited = 'Draft post for Linden Street Kitchen: "Tamales are back on Thursdays."';
    await decideCard(store, SESSION, card, { decision: "approve", body: edited }, TEN_AM_EASTERN);

    const [entry] = await store.listOutbox(SESSION, BUSINESS);
    expect(entry?.body).toContain("Tamales are back on Thursdays.");
    expect(entry?.body).not.toContain("hasn't changed in 3 months");
  });

  it("saves an approved mapped edit back to the profile", async () => {
    await store.saveBusiness(SESSION, profileFromFacts({
      id: BUSINESS,
      name: "Apex Heating",
      trade: "HVAC",
      tradeKey: "home",
      reach: [],
      tools: [],
      signals: ["quotes"],
    }));
    const card = await addCard({
      ...missedCallText,
      key: `${BUSINESS}:quote-edit`,
      channel: "telegram",
      body: "We'll confirm the price.",
      editMap: { body: "prices" },
    });

    await decideCard(store, SESSION, card, { decision: "approve", body: "Replacement visit: $200 to $300." }, TEN_AM_EASTERN);

    expect((await store.getBusiness(SESSION, BUSINESS))?.details?.prices).toEqual([{ item: "Replacement visit", low: 200, high: 300 }]);
    expect((await store.listProfileVersions(SESSION, BUSINESS))[0]?.changedBy).toBe("card_edit");
  });

  it("refuses an email that answers an allergy question and leaves it pending", async () => {
    const card = await addCard({ ...missedCallText, key: `${BUSINESS}:catering`, skill: "catering", channel: "email", body: "Yes, the mole is safe for a peanut allergy." });
    const result = await decideCard(store, SESSION, card, { decision: "approve" }, TEN_AM_EASTERN);

    expect(result.ok && result.response.blocked).toBeTruthy();
    expect(await store.listOutbox(SESSION, BUSINESS)).toHaveLength(0);
    expect((await store.getCard(SESSION, card.id))?.status).toBe("pending");
  });

  it("puts the opt-out line back on a text whose edit dropped it", async () => {
    const card = await addCard(missedCallText);
    await decideCard(store, SESSION, card, { decision: "approve", body: "Hi, sorry we missed you. Call back anytime." }, TEN_AM_EASTERN);

    expect((await store.listOutbox(SESSION, BUSINESS))[0]?.body).toBe("Hi, sorry we missed you. Call back anytime. Reply STOP to opt out.");
  });

  it("refuses a draft that still has a placeholder", async () => {
    const card = await addCard({ ...missedCallText, key: `${BUSINESS}:reviewer`, skill: "reviewer", body: "Leave us a review: [your review link]. Reply STOP to opt out." });
    const result = await decideCard(store, SESSION, card, { decision: "approve" }, TEN_AM_EASTERN);

    expect(result.ok && result.response.blocked).toMatch(/your review link/);
    expect(await store.listOutbox(SESSION, BUSINESS)).toHaveLength(0);
  });

  it("never sends a locked card, even when approved", async () => {
    const card = await addCard({ ...missedCallText, key: `${BUSINESS}:locked:0`, channel: "locked" });
    await decideCard(store, SESSION, card, { decision: "approve" }, TEN_AM_EASTERN);

    expect(await store.listOutbox(SESSION, BUSINESS)).toHaveLength(0);
    expect((await store.getCard(SESSION, card.id))?.status).toBe("approved");
  });

  it("rejects a second decision on the same card", async () => {
    const card = await addCard(missedCallText);
    await decideCard(store, SESSION, card, { decision: "skip" }, TEN_AM_EASTERN);
    const decided = await store.getCard(SESSION, card.id);
    if (!decided) throw new Error("test setup: card disappeared");

    const second = await decideCard(store, SESSION, decided, { decision: "approve" }, TEN_AM_EASTERN);
    expect(second).toEqual({ ok: false, status: 409, error: "This card was already decided." });
  });

  it("sends once when two approvals of the same pending card race", async () => {
    const card = await addCard(missedCallText);
    // Both requests read the card while it was pending, like a double tap.
    const results = await Promise.all([
      decideCard(store, SESSION, card, { decision: "approve" }, TEN_AM_EASTERN),
      decideCard(store, SESSION, card, { decision: "approve" }, TEN_AM_EASTERN),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results).toContainEqual({ ok: false, status: 409, error: "This card was already decided." });
    expect(await store.listOutbox(SESSION, BUSINESS)).toHaveLength(1);
  });
});
