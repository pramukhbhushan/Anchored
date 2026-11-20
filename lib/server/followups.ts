import "server-only";
import { randomUUID } from "node:crypto";
import type { Contact } from "@/lib/domain/contacts";
import type { FollowupInput, RecordedFollowup } from "@/lib/domain/followups";
import { chosenSkills, resolveChoices } from "@/lib/domain/paths";
import type { BusinessProfile } from "@/lib/domain/types";
import { runBusinessAgentWork } from "@/lib/server/agent-work";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// The store flows behind `/api/businesses/[id]/followups`: list, record and
// cancel one business's Customer timers. Recording or cancelling runs the
// business's agent work at once, so a timer already due becomes a card for
// approval and a cancelled one invalidates its old drafts. The caller passes a
// business it already found for this session; the request never names one.
// `followupSchedule` reads what the Customer workspace's schedule shows.

const FOLLOWUP_LIMIT = 200;

/** A follow-up change: the business's timers after it, or the refusal the route answers with. */
export type FollowupResult =
  | { readonly ok: true; readonly records: readonly RecordedFollowup[] }
  | { readonly ok: false; readonly status: 404 | 409; readonly error: string };

/** Return the business's recorded timers. */
export async function listFollowups(session: string, business: BusinessProfile): Promise<RecordedFollowup[]> {
  return getStore().listFollowups(session, business.id);
}

/** Return the business's timers and the customers who started its Telegram chat, for the follow-up schedule. */
export async function followupSchedule(session: string, business: BusinessProfile): Promise<{ readonly records: RecordedFollowup[]; readonly contacts: Contact[] }> {
  const store = getStore();
  const [records, contacts] = await Promise.all([store.listFollowups(session, business.id), store.listContacts(session, business.id)]);
  return { records, contacts: contacts.filter((contact) => contact.telegramChatId !== undefined) };
}

/** Record explicit facts and a due time for one customer, then check whether an approval draft is due. */
export async function recordFollowup(session: string, business: BusinessProfile, input: FollowupInput): Promise<FollowupResult> {
  const store = getStore();
  const records = await store.listFollowups(session, business.id);
  if (records.length >= FOLLOWUP_LIMIT) return { ok: false, status: 409, error: "This business already has 200 recorded follow-ups." };
  const contacts = await store.listContacts(session, business.id);
  const contact = contacts.find((candidate) => candidate.id === input.contactId);
  if (contact === undefined) return { ok: false, status: 404, error: "Customer not found in this business." };
  if (input.skill !== "debrief" && (contact.telegramChatId === undefined || contact.consent === null || contact.optedOutAt !== null)) {
    return { ok: false, status: 409, error: "This customer must start your Telegram chat before you can record a follow-up message." };
  }
  const chosen = chosenSkills(business, resolveChoices(business, await store.getChoices(session, business.id)));
  if (!chosen.includes(input.skill)) return { ok: false, status: 409, error: "Choose this job on Workflows before recording its follow-up." };
  await store.saveFollowup(session, { ...input, dueAt: new Date(input.dueAt).toISOString(), id: randomUUID(), businessId: business.id, status: "active" });
  await runBusinessAgentWork(store, session, business);
  return { ok: true, records: await store.listFollowups(session, business.id) };
}

/** Cancel one existing timer owned by this business, keeping its facts. */
export async function cancelFollowup(session: string, business: BusinessProfile, id: string): Promise<FollowupResult> {
  const store = getStore();
  const record = (await store.listFollowups(session, business.id)).find((item) => item.id === id);
  if (record === undefined) return { ok: false, status: 404, error: "Follow-up not found in this business." };
  await store.saveFollowup(session, { ...record, status: "cancelled" });
  await runBusinessAgentWork(store, session, business);
  return { ok: true, records: await store.listFollowups(session, business.id) };
}
