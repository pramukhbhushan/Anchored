import "server-only";
import { notFound } from "next/navigation";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import { draftFeed } from "@/lib/domain/cards";
import { CASE_STUDIES, caseStudyById } from "@/lib/domain/cases";
import { chosenSkills, resolveChoices, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, SkillId, WorkflowId } from "@/lib/domain/types";
import { getStore } from "@/lib/store";
import { getSessionId } from "./session";

// =============================================================================
// Module Overview
// =============================================================================
// Server-side reads for pages and API routes. Case studies come from code; a
// session's own businesses, choices and cards come from the `Store`. `getFeed`
// also syncs card drafts for the agents the owner has chosen.

/** Return the case studies, then the session's own businesses. */
export async function listBusinesses(): Promise<BusinessProfile[]> {
  const session = await getSessionId();
  return [...CASE_STUDIES, ...(await getStore().listBusinesses(session))];
}

/** Return a case study or one of the session's businesses, or `null`. */
export async function findBusiness(id: string): Promise<BusinessProfile | null> {
  const caseStudy = caseStudyById(id);
  if (caseStudy) return caseStudy;
  return getStore().getBusiness(await getSessionId(), id);
}

/** Return the business for a page, or render the 404 page. */
export async function getBusinessOrNotFound(id: string): Promise<BusinessProfile> {
  const business = await findBusiness(id);
  if (!business) notFound();
  return business;
}

/** Return the chosen path for each of the business's workflows, filling in Anchored's picks. */
export async function getChoices(business: BusinessProfile): Promise<Record<WorkflowId, Choice>> {
  const saved = await getStore().getChoices(await getSessionId(), business.id);
  return resolveChoices(business, saved);
}

/** Narrow `choices` so only `skill` is built, letting a simulation target one skill. */
export function choicesForSkill(business: BusinessProfile, choices: Record<WorkflowId, Choice>, skill: SkillId): Record<WorkflowId, Choice> {
  const narrowed = { ...choices };
  for (const workflow of workflowIdsOf(business)) {
    const choice = choices[workflow];
    narrowed[workflow] = choice.path === "build" && choice.skills.includes(skill) ? { path: "build", skills: [skill] } : { path: "skip" };
  }
  return narrowed;
}

/** Return the next simulation number for a business, so each simulated card gets a fresh, stable key. */
export async function nextSimulationTurn(businessId: string): Promise<number> {
  const cards = await getStore().listCards(await getSessionId(), businessId);
  return cards.filter((card) => card.key.includes(":sim:")).length + 1;
}

/** Order a feed: pending cards first, newest first, then decided cards, latest decision first. */
function feedOrder(a: CardRecord, b: CardRecord): number {
  const aPending = a.status === "pending";
  const bPending = b.status === "pending";
  if (aPending !== bPending) return aPending ? -1 : 1;
  const aTime = aPending ? a.createdAt : (a.decidedAt ?? a.createdAt);
  const bTime = bPending ? b.createdAt : (b.decidedAt ?? b.createdAt);
  return bTime.localeCompare(aTime);
}

/** Return the cards for the business's chosen skills and its simulated outbox. */
export async function getFeed(business: BusinessProfile): Promise<{ cards: CardRecord[]; outbox: OutboxEntry[] }> {
  const session = await getSessionId();
  const store = getStore();
  const choices = await getChoices(business);
  await store.ensureCards(session, business.id, draftFeed(business, choices));
  // Internal Communications' triage runs for every business; other skills only while chosen.
  const live = new Set<SkillId>([...chosenSkills(business, choices), "triage"]);
  // Cards stay stored when an owner switches a workflow away from Build; hide them until it switches back.
  const cards = (await store.listCards(session, business.id)).filter((card) => card.skill !== null && live.has(card.skill));
  return { cards: cards.sort(feedOrder), outbox: await store.listOutbox(session, business.id) };
}
