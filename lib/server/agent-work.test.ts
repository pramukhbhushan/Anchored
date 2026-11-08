import { beforeEach, describe, expect, it } from "vitest";
import type { CardRecord } from "@/lib/api/contract";
import type { Contact } from "@/lib/domain/contacts";
import type { RecordedFollowup } from "@/lib/domain/followups";
import type { BusinessProfile, KeyedCard } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";
import { customerLocked, followupStillAllowed, runBusinessAgentWork, runDueAgentWork } from "./agent-work";

// =============================================================================
// Module Overview
// =============================================================================
// Recorded timers and license facts create owner-only approval work, with
// stable identity, current consent and tenant boundaries. Canceled or changed
// facts invalidate old drafts even after approval, before delivery can occur.

const SESSION = "owner";
const NOW = new Date("2026-11-09T15:00:00Z");
const base = hvacShop();
const SHOP: BusinessProfile = { ...base, signals: [...base.signals, "licenses"], workflows: { ...base.workflows, licenses: { fit: 3, rec: "build", why: "Owner records expiry dates", stake: "", isNew: true } } };
let store: MemoryStore;
let contact: Contact;
let timer: RecordedFollowup;

beforeEach(async () => {
  store = new MemoryStore();
  await store.saveBusiness(SESSION, SHOP);
  await store.setChoice(SESSION, SHOP.id, "calls", { path: "build", skills: ["callback"] });
  await store.setChoice(SESSION, SHOP.id, "quotes", { path: "build", skills: ["closer"] });
  await store.setChoice(SESSION, SHOP.id, "licenses", { path: "build", skills: ["license"] });
  contact = await store.saveContact(SESSION, { businessId: SHOP.id, name: "Dana", phone: null, email: null, consent: { source: "messaged-first", at: "2026-11-08T12:00:00Z" }, optedOutAt: null, telegramChatId: "123" });
  timer = { id: "timer-1", businessId: SHOP.id, contactId: contact.id, skill: "callback", dueAt: "2026-11-09T14:00:00.000Z", state: "missed-call", sourceId: "call:one", evidence: "The owner recorded a missed call on November 9.", status: "active" };
  await store.saveFollowup(SESSION, timer);
});

async function followupCard(): Promise<CardRecord> {
  const card = (await store.listCards(SESSION, SHOP.id)).find((item) => item.recordedFollowup !== undefined);
  if (card === undefined) throw new Error("Expected a recorded follow-up card.");
  return card;
}

const lock = (key: string): KeyedCard => ({ key, agent: "frontdesk", skill: "inquiry", title: "Allergy question", body: "Handle this yourself.", reason: "", checks: [], action: "I'll handle it", channel: "locked" });

describe("recorded agent work", () => {
  it("creates one pending draft under repeated and concurrent runs, without an outbox write", async () => {
    await Promise.all([runBusinessAgentWork(store, SESSION, SHOP, NOW), runBusinessAgentWork(store, SESSION, SHOP, NOW)]);
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    const cards = await store.listCards(SESSION, SHOP.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ status: "pending", channel: "telegram", skill: "callback", contact: contact.id, recordedFollowup: { id: timer.id, dueAt: timer.dueAt, sourceId: timer.sourceId } });
    expect(await store.listOutbox(SESSION, SHOP.id)).toEqual([]);
  });

  it("dedupes separate records for the same customer, source and due-day window", async () => {
    await store.saveFollowup(SESSION, { ...timer, id: "timer-2", dueAt: "2026-11-09T14:30:00.000Z" });
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    expect((await store.listCards(SESSION, SHOP.id)).filter((card) => card.recordedFollowup !== undefined)).toHaveLength(1);
  });

  it("does not draft early or after the owner chooses another workflow path", async () => {
    await runBusinessAgentWork(store, SESSION, SHOP, new Date("2026-11-09T13:00:00Z"));
    expect(await store.listCards(SESSION, SHOP.id)).toEqual([]);
    await store.setChoice(SESSION, SHOP.id, "calls", { path: "skip" });
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    expect(await store.listCards(SESSION, SHOP.id)).toEqual([]);
  });

  it("suppresses work after STOP or an allergy lock without hiding the lock", async () => {
    await store.saveContact(SESSION, { ...contact, optedOutAt: NOW.toISOString() });
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    expect(await store.listCards(SESSION, SHOP.id)).toEqual([]);
    await store.saveContact(SESSION, contact);
    await store.ensureCards(SESSION, SHOP.id, [{ ...lock("allergy"), lockedContact: contact.id }]);
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    expect(await customerLocked(store, SESSION, SHOP.id, contact.id)).toBe(true);
    expect(await store.listCards(SESSION, SHOP.id)).toMatchObject([{ key: "allergy", status: "pending" }]);
  });

  it("recognizes older allergy locks by their scoped incoming thread message", async () => {
    await store.ensureCards(SESSION, SHOP.id, [lock("old-allergy")]);
    await store.addThreadMessage(SESSION, { businessId: SHOP.id, contactId: contact.id, direction: "in", text: "A question", skill: null, cardKey: "old-allergy", outboxId: null, providerId: "in-1", at: NOW.toISOString() });
    expect(await customerLocked(store, SESSION, SHOP.id, contact.id)).toBe(true);
    expect(await customerLocked(store, "other-owner", SHOP.id, contact.id)).toBe(false);
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    expect((await store.listCards(SESSION, SHOP.id)).some((card) => card.recordedFollowup)).toBe(false);
  });

  it("cancellation supersedes pending work and invalidates an approved old draft", async () => {
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    const card = await followupCard();
    expect(await followupStillAllowed(store, SESSION, SHOP, card, NOW)).toBe(true);
    await store.saveFollowup(SESSION, { ...timer, status: "cancelled" });
    expect(await followupStillAllowed(store, SESSION, SHOP, { ...card, status: "approved" }, NOW)).toBe(false);
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    expect((await store.getCard(SESSION, card.id))?.status).toBe("superseded");
  });

  it("changed dates and another session cannot authorize an existing draft", async () => {
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    const card = await followupCard();
    await store.saveFollowup(SESSION, { ...timer, dueAt: "2026-11-10T14:00:00.000Z" });
    expect(await followupStillAllowed(store, SESSION, SHOP, card, NOW)).toBe(false);
    expect(await followupStillAllowed(store, "other-owner", SHOP, card, NOW)).toBe(false);
    expect(await store.listFollowups("other-owner", SHOP.id)).toEqual([]);
  });

  it("does not allow a fourth approved quote follow-up for the recorded source", async () => {
    const quote: RecordedFollowup = { ...timer, skill: "closer", state: "open-quote", sourceId: "quote:Q1" };
    await store.saveFollowup(SESSION, { ...timer, status: "cancelled" });
    await store.saveFollowup(SESSION, quote);
    const drafts: KeyedCard[] = [1, 2, 3].map((touch) => ({ key: `previous:${touch}`, agent: "followup", skill: "closer", title: "Follow-up", body: "Hello", reason: "", checks: [], action: "Send", channel: "telegram", contact: contact.id, recordedFollowup: { id: `old-${touch}`, dueAt: timer.dueAt, sourceId: quote.sourceId } }));
    await store.ensureCards(SESSION, SHOP.id, drafts);
    for (const card of await store.listCards(SESSION, SHOP.id)) await store.updatePendingCard(SESSION, card.id, { status: "approved" });
    await runBusinessAgentWork(store, SESSION, SHOP, NOW);
    expect((await store.listCards(SESSION, SHOP.id)).filter((card) => card.status === "pending")).toEqual([]);
  });

  it("runs scheduled targets under their own session", async () => {
    const other = { ...SHOP, id: "second-shop" };
    await store.saveBusiness("other-owner", other);
    const outcome = await runDueAgentWork(NOW, store);
    expect(outcome).toEqual({ drafted: 1, failed: 0 });
    expect(await store.listCards("other-owner", SHOP.id)).toEqual([]);
    expect(await store.listCards(SESSION, other.id)).toEqual([]);
  });
});

describe("license reminders", () => {
  const license = { id: "contractor-license", name: "Contractor license", expiresOn: "2026-11-30", evidence: "Expiry printed on the license." };
  const licensed = (): BusinessProfile => ({ ...SHOP, details: { ...SHOP.details, licenses: [license] } });

  it("persists evidenced dates in the profile and emits one owner-only notice per window", async () => {
    const business = await store.saveBusiness(SESSION, licensed());
    await runBusinessAgentWork(store, SESSION, business, NOW);
    await runBusinessAgentWork(store, SESSION, business, NOW);
    const notices = (await store.listCards(SESSION, SHOP.id)).filter((card) => card.renewal !== undefined);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ skill: "license", channel: "flag", body: expect.stringContaining(license.evidence), renewal: { licenseId: license.id, expiresOn: license.expiresOn } });
    expect((await store.getBusiness(SESSION, SHOP.id))?.details?.licenses).toEqual([license]);
    expect((await store.listProfileVersions(SESSION, SHOP.id))[0]?.snapshot.details?.licenses).toEqual([license]);
    expect(await store.listOutbox(SESSION, SHOP.id)).toEqual([]);
  });

  it("replaces an older pending warning on window change and stops completed licenses", async () => {
    const business = licensed();
    await runBusinessAgentWork(store, SESSION, business, NOW);
    await runBusinessAgentWork(store, SESSION, business, new Date("2026-11-24T15:00:00Z"));
    expect((await store.listCards(SESSION, SHOP.id)).filter((card) => card.renewal !== undefined).map((card) => card.status)).toEqual(["superseded", "pending"]);
    await runBusinessAgentWork(store, SESSION, { ...business, details: { ...business.details, licenses: [{ ...license, completed: true }] } }, new Date("2026-11-24T15:00:00Z"));
    expect((await store.listCards(SESSION, SHOP.id)).filter((card) => card.renewal !== undefined).every((card) => card.status === "superseded")).toBe(true);
  });

  it("supersedes stale dates and requires License Clerk to remain chosen", async () => {
    const business = licensed();
    await runBusinessAgentWork(store, SESSION, business, NOW);
    await runBusinessAgentWork(store, SESSION, { ...business, details: { licenses: [{ ...license, expiresOn: "2027-11-30" }] } }, NOW);
    expect((await store.listCards(SESSION, SHOP.id)).filter((card) => card.renewal !== undefined).every((card) => card.status === "superseded")).toBe(true);
    await store.setChoice(SESSION, SHOP.id, "licenses", { path: "skip" });
    await runBusinessAgentWork(store, SESSION, business, NOW);
    expect((await store.listCards(SESSION, SHOP.id)).filter((card) => card.renewal !== undefined && card.status === "pending")).toEqual([]);
  });
});
