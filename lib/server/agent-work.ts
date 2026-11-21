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
// Turns what the owner recorded, such as a quote to follow up on or a license
// expiry date, into cards for approval. It never sends. The scheduled run drafts
// each card once its time comes, and `followupStillAllowed` runs the same checks
// again when the owner approves and when the message goes out, so a cancelled
// follow-up, a STOP, an allergy question, a changed date or a job the owner
// turned off stops it. Each card's key is fixed, so two runs at once draft it once.

/** Whether an allergy question from this contact waits for the owner among `cards`, which locks their follow-ups. */
function lockedAmong(cards: readonly CardRecord[], contactId: string): boolean {
  return cards.some((card) => card.channel === "locked" && card.status === "pending" && (card.contact === contactId || card.lockedContact === contactId));
}

/** Count already approved touches to this recorded quote or call, excluding the current card. */
function touches(cards: readonly CardRecord[], record: RecordedFollowup, except?: string): number {
  return cards.filter((card) => card.id !== except && card.status === "approved" && card.contact === record.contactId && card.skill === record.skill && card.recordedFollowup?.sourceId === record.sourceId).length;
}

/** Whether a follow-up card may still go out: its record is unchanged and the follow-up is still due under today's facts. */
export async function followupStillAllowed(store: Store, session: string, business: BusinessProfile, card: CardRecord, now: Date): Promise<boolean> {
  if (card.recordedFollowup === undefined) return true;
  const record = (await store.listFollowups(session, business.id)).find((item) => item.id === card.recordedFollowup!.id);
  if (record === undefined || record.contactId !== card.contact || record.skill !== card.skill || record.dueAt !== card.recordedFollowup.dueAt || record.sourceId !== card.recordedFollowup.sourceId) return false;
  const [contacts, saved, cards] = await Promise.all([store.listContacts(session, business.id), store.getChoices(session, business.id), store.listCards(session, business.id)]);
  const locked = lockedAmong(cards, record.contactId);
  return dueFollowup(record, { now, chosen: new Set(chosenSkills(business, resolveChoices(business, saved))), contact: contacts.find((c) => c.id === record.contactId) ?? null, locked, businessName: business.name, previousTouches: touches(cards, record, card.id) }) !== null;
}

/** Draft the cards that are due from what the owner recorded, supersede pending ones no longer due, and return how many are new. */
export async function runBusinessAgentWork(store: Store, session: string, business: BusinessProfile, now = new Date()): Promise<number> {
  if (business.kind !== "custom") return 0;
  const [records, contacts, saved, cards] = await Promise.all([store.listFollowups(session, business.id), store.listContacts(session, business.id), store.getChoices(session, business.id), store.listCards(session, business.id)]);
  const chosen = new Set<SkillId>(chosenSkills(business, resolveChoices(business, saved)));
  const drafts: KeyedCard[] = [];
  for (const record of records) {
    const draft = dueFollowup(record, { now, chosen, contact: contacts.find((c) => c.id === record.contactId) ?? null, locked: lockedAmong(cards, record.contactId), businessName: business.name, previousTouches: touches(cards, record) });
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

/** Run every business's agent work for the scheduler, each under its own session, and count drafts and failures. */
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
