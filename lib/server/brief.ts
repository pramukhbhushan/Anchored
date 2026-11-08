import "server-only";
import type { BriefResponse } from "@/lib/api/contract";
import { briefLines, briefSnapshot, type BriefSnapshot } from "@/lib/domain/brief";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import { agentForSkill } from "@/lib/domain/paths";
import type { BusinessProfile, KeyedCard } from "@/lib/domain/types";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Internal Communications' daily brief. One run counts the business's cards,
// sends and opt-outs since the last brief that finished (`briefSnapshot`),
// writes the lines from those counts alone, and leaves one card for the owner
// that sends nothing. The model writes none of it. A run started while another
// is going does nothing, and a failed run leaves the last good brief and its
// window, so nothing is missed or counted twice. The owner's Run now and the
// scheduled pass both go through `runBrief`.

// A run that hasn't finished in this long crashed; the next one may take over.
const RETAKE_AFTER_MS = 2 * 60 * 1000;

// The scheduled brief comes once a day, from this hour on, in the owner's time zone.
const BRIEF_HOUR = 7;

/** Return the last finished brief for `business`, or what stands in for it before the first one. */
export async function readBrief(session: string, business: BusinessProfile): Promise<BriefResponse> {
  if (business.kind === "case") return unavailable();
  const state = await getStore().getBriefState(session, business.id);
  return response(state?.lastSnapshot ?? null, state?.lastSuccessAt ?? null, state?.lastCardKey ?? null, false);
}

/** Write a brief now, unless one is already being written. Returns the newest finished brief either way. */
export async function runBrief(session: string, business: BusinessProfile, now = new Date()): Promise<BriefResponse> {
  if (business.kind === "case") return unavailable();
  const store = getStore();
  if (!(await store.claimBriefRun(session, business.id, now.toISOString(), RETAKE_AFTER_MS))) {
    return { ...(await readBrief(session, business)), running: true };
  }
  try {
    const [before, cards, outbox, contacts] = await Promise.all([
      store.getBriefState(session, business.id),
      store.listCards(session, business.id),
      store.listOutbox(session, business.id),
      store.listContacts(session, business.id),
    ]);
    const at = now.toISOString();
    const snapshot = briefSnapshot({ cards, outbox, optedOutAt: contacts.map((contact) => contact.optedOutAt), since: before?.lastSuccessAt ?? null, now: at });
    const key = `${business.id}:brief:${now.getTime()}`;
    await store.ensureCards(session, business.id, [briefCard(business, snapshot, key)]);
    // One brief waits at a time: the new one replaces any the owner hasn't read.
    for (const card of cards) {
      if (card.skill === "brief" && card.status === "pending" && card.key !== key) await store.updatePendingCard(session, card.id, { status: "superseded", decidedAt: at });
    }
    await store.finishBriefRun(session, business.id, { ok: true, at, cardKey: key, snapshot });
    return response(snapshot, at, key, false);
  } catch (error) {
    await store.finishBriefRun(session, business.id, { ok: false }).catch(() => undefined);
    throw error;
  }
}

/** Write today's brief for every stored business that hasn't had one today, once it's past the morning hour. */
export async function runDueBriefs(now: Date, limit = 200): Promise<{ readonly written: number; readonly skipped: number; readonly failed: number }> {
  const store = getStore();
  const counts = { written: 0, skipped: 0, failed: 0 };
  if (localHour(now) < BRIEF_HOUR) return counts;
  for (const { session, businessId } of await store.listBriefTargets(limit)) {
    try {
      const [business, state] = await Promise.all([store.getBusiness(session, businessId), store.getBriefState(session, businessId)]);
      if (business === null || (state?.lastSuccessAt != null && localDay(new Date(state.lastSuccessAt)) === localDay(now))) {
        counts.skipped += 1;
        continue;
      }
      const result = await runBrief(session, business, now);
      counts[result.running ? "skipped" : "written"] += 1;
    } catch (error) {
      // One business's failure must not stop the others' briefs.
      console.error(`[Brief] The scheduled brief for business ${businessId} failed.`, error);
      counts.failed += 1;
    }
  }
  return counts;
}

/** The brief's card for the owner: the lines, with nothing to send. */
function briefCard(business: BusinessProfile, snapshot: BriefSnapshot, key: string): KeyedCard {
  return {
    key,
    agent: agentForSkill(business, "brief"),
    skill: "brief",
    title: snapshot.waiting === 0 ? "Your brief: nothing waits for you" : `Your brief: ${snapshot.waiting} waiting`,
    body: briefLines(snapshot).join("\n"),
    reason: "Internal Communications counted this from your cards, sends and contacts. No number in it comes from AI.",
    checks: ["Counted by code", "Nothing is sent to anyone"],
    action: "Mark read",
    // A flag card is decided with no outbox entry, which is right for a note only the owner reads.
    channel: "flag",
  };
}

/** A brief response from a snapshot, or the empty state before the first brief. */
function response(snapshot: BriefSnapshot | null, lastRunAt: string | null, cardKey: string | null, running: boolean): BriefResponse {
  return {
    lines: snapshot === null ? ["No brief yet. Run one now, or wait for the morning brief."] : briefLines(snapshot),
    snapshot,
    lastRunAt,
    cardKey,
    running,
    unavailableReason: null,
  };
}

/** The shared example's brief: read-only, so it has none of its own. */
function unavailable(): BriefResponse {
  return { lines: [], snapshot: null, lastRunAt: null, cardKey: null, running: false, unavailableReason: "This is the shared example, so it has no daily brief. Create your own business to get one." };
}

/** The hour, 0 to 23, in the owner's time zone. */
function localHour(at: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: OWNER_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(at));
}

/** The calendar day in the owner's time zone, such as "2026-11-08". */
function localDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OWNER_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
