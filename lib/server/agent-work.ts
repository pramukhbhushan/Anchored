import "server-only";
import type { CardRecord } from "@/lib/api/contract";
import { dueFollowup, type RecordedFollowup } from "@/lib/domain/followups";
import { agentForSkill, chosenSkills, resolveChoices } from "@/lib/domain/paths";
import { renewalNotice } from "@/lib/domain/renewals";
import type { BusinessProfile, KeyedCard, SkillId } from "@/lib/domain/types";
import { getStore, type Store } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Owner-recorded facts produce approval cards, never sends. The dispatch cron
// checks due facts and the same checks run again at approval and delivery.
// Cancellations, STOP, allergy locks, changed dates and disabled skills prevent
// old work from going out. Stable card keys dedupe concurrent scheduled runs.

/** Check a contact's persisted allergy locks, including older cards linked through its thread. */
export async function customerLocked(store: Store, session: string, businessId: string, contactId: string): Promise<boolean> {
  return lockedAmong(await store.listCards(session, businessId), store, session, businessId, contactId);
}

/** `customerLocked` over cards the caller already read, so a loop over many customers reads them once. */
async function lockedAmong(cards: readonly CardRecord[], store: Store, session: string, businessId: string, contactId: string): Promise<boolean> {
  const locked = cards.filter((card) => card.channel === "locked" && card.status === "pending");
  if (locked.some((card) => (card.contact === contactId || card.lockedContact === contactId))) return true;
  if (locked.length === 0) return false;
  const keys = new Set(locked.map((card) => card.key));
  return (await store.listThreadMessages(session, businessId, contactId, 200)).some((message) => message.cardKey !== null && keys.has(message.cardKey));
}

/** Count already approved touches to this recorded quote or call, excluding the current card. */
function touches(cards: readonly CardRecord[], record: RecordedFollowup, except?: string): number {
  return cards.filter((card) => card.id !== except && card.status === "approved" && card.contact === record.contactId && card.skill === record.skill && card.recordedFollowup?.sourceId === record.sourceId).length;
}

/** Revalidate a recorded timer against current scoped facts before an old card can send. */
export async function followupStillAllowed(store: Store, session: string, business: BusinessProfile, card: CardRecord, now: Date): Promise<boolean> {
  if (card.recordedFollowup === undefined) return true;
  const record = (await store.listFollowups(session, business.id)).find((item) => item.id === card.recordedFollowup!.id);
  if (record === undefined || record.contactId !== card.contact || record.skill !== card.skill || record.dueAt !== card.recordedFollowup.dueAt || record.sourceId !== card.recordedFollowup.sourceId) return false;
  const [contacts, saved, cards] = await Promise.all([store.listContacts(session, business.id), store.getChoices(session, business.id), store.listCards(session, business.id)]);
  const locked = await lockedAmong(cards, store, session, business.id, record.contactId);
  return dueFollowup(record, { now, chosen: new Set(chosenSkills(business, resolveChoices(business, saved))), contact: contacts.find((c) => c.id === record.contactId) ?? null, locked, businessName: business.name, previousTouches: touches(cards, record, card.id) }) !== null;
}

/** Build due owner cards from current recorded facts and replace stale pending reminders. */
export async function runBusinessAgentWork(store: Store, session: string, business: BusinessProfile, now = new Date()): Promise<number> {
  if (business.kind !== "custom") return 0;
  const [records, contacts, saved, cards] = await Promise.all([store.listFollowups(session, business.id), store.listContacts(session, business.id), store.getChoices(session, business.id), store.listCards(session, business.id)]);
  const chosen = new Set<SkillId>(chosenSkills(business, resolveChoices(business, saved)));
  const drafts: KeyedCard[] = [];
  for (const record of records) {
    const draft = dueFollowup(record, { now, chosen, contact: contacts.find((c) => c.id === record.contactId) ?? null, locked: await lockedAmong(cards, store, session, business.id, record.contactId), businessName: business.name, previousTouches: touches(cards, record) });
    if (draft !== null) {
      const { contactId: _contact, ...words } = draft;
      drafts.push({ ...words, contact: record.contactId, agent: agentForSkill(business, record.skill), recordedFollowup: { id: record.id, dueAt: record.dueAt, sourceId: record.sourceId } });
    }
  }
  if (chosen.has("license")) {
    for (const license of business.details?.licenses ?? []) {
      const notice = renewalNotice(license, now);
      if (notice !== null) drafts.push({ key: `${business.id}:${notice.key}`, agent: agentForSkill(business, "license"), skill: "license", title: notice.title, body: notice.body, reason: "The expiry date and its source were recorded by you.", checks: ["Owner task only", "No renewal or filing performed"], action: "Mark read", channel: "flag", renewal: { licenseId: license.id, expiresOn: license.expiresOn } });
    }
  }
  const keys = new Set(drafts.map((draft) => draft.key));
  for (const card of cards) {
    if (card.status === "pending" && (card.recordedFollowup !== undefined || card.renewal !== undefined) && !keys.has(card.key)) await store.updatePendingCard(session, card.id, { status: "superseded", decidedAt: now.toISOString() });
  }
  const unique = [...new Map(drafts.map((draft) => [draft.key, draft])).values()];
  await store.ensureCards(session, business.id, unique);
  const existing = new Set(cards.map((card) => card.key));
  return unique.filter((draft) => !existing.has(draft.key)).length;
}

/** Check the same bounded business targets as the brief scheduler, preserving each row's owning session. */
export async function runDueAgentWork(now = new Date(), store: Store = getStore(), limit = 200): Promise<{ drafted: number; failed: number }> {
  const result = { drafted: 0, failed: 0 };
  for (const target of await store.listBriefTargets(limit)) {
    try {
      const business = await store.getBusiness(target.session, target.businessId);
      if (business !== null) result.drafted += await runBusinessAgentWork(store, target.session, business, now);
    } catch (error) {
      // One business's failure must not stop the others' work.
      console.error(`[Agent work] The scheduled run for business ${target.businessId} failed.`, error);
      result.failed += 1;
    }
  }
  return result;
}
