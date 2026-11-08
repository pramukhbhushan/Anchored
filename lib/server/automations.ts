import "server-only";
import type { SetAutomationResponse } from "@/lib/api/contract";
import { pathOptions } from "@/lib/domain/paths";
import { automationQuestion, isAskable } from "@/lib/domain/requests";
import type { BusinessProfile, Choice, WorkflowId } from "@/lib/domain/types";
import { WORKFLOWS } from "@/lib/domain/workflows";
import { askInChat } from "@/lib/server/business-chat";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// The on/off switch on the Automations page. Off means nobody handles the job.
// On picks who does it in code: Anchored when that's the plan's pick, else an
// app the owner already has, else Anchored. It never signs the owner up for a
// new app. Turning on a job Anchored drafts puts that job's first question in
// the business chat, such as "Can you give a brief intro about what your post
// is going to be about?", so the owner can start right away.

/** Why a job can't be turned on: Anchored doesn't draft it and the owner has no app for it. */
export class NothingToTurnOnError extends Error {}

/** The choice that turns `workflow` on, or `null` when nothing the owner has can do it. */
export function onChoice(business: BusinessProfile, workflow: WorkflowId): Choice | null {
  const options = pathOptions(business, workflow);
  const plan = business.workflows[workflow];
  const build: Choice | null = options.build === null ? null : { path: "build", skills: options.build.skills };
  const owned = options.owned.find((tool) => tool.id === plan?.tool) ?? options.owned[0];
  const turnOn: Choice | null = owned === undefined ? null : { path: "turnon", toolId: owned.id };
  if (plan?.rec === "build" && build !== null) return build;
  return turnOn ?? build;
}

/** Turn `workflow` on or off for `business`, and ask the first question in chat when Anchored now drafts it. */
export async function setAutomation(session: string, business: BusinessProfile, workflow: WorkflowId, on: boolean): Promise<SetAutomationResponse> {
  const choice = on ? onChoice(business, workflow) : { path: "skip" as const };
  if (choice === null) throw new NothingToTurnOnError("Anchored doesn't draft this job, and you don't have an app for it yet. Pick one under Compare apps.");
  await getStore().setChoice(session, business.id, workflow, choice);
  if (choice.path !== "build") return { choice, asked: false };
  const skill = choice.skills.find(isAskable);
  const question = skill === undefined ? null : automationQuestion(skill, WORKFLOWS[workflow].name);
  if (question === null) return { choice, asked: false };
  await askInChat(session, business, question);
  return { choice, asked: true };
}
