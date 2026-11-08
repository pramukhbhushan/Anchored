import "server-only";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { toolById } from "@/lib/domain/catalog";
import { pathOptions } from "@/lib/domain/paths";
import type { BusinessProfile, Choice } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Turns an owner's request for who handles a job into the `Choice` to save,
// checked against the job's real options, so a request cannot turn on a tool
// the business doesn't own or build an agent that doesn't exist. The choices
// route and the route that adds a job share it.

/** The choice to save, or the status and owner-facing reason a request was refused. */
export type ChoiceCheck =
  | { readonly ok: true; readonly choice: Choice }
  | { readonly ok: false; readonly status: 400 | 409; readonly error: string };

/** Check `request` against the options its workflow has at `business`, and return the choice to save or why not. */
export function checkChoice(business: BusinessProfile, request: SetChoiceRequest): ChoiceCheck {
  const options = pathOptions(business, request.workflow);
  if (request.path === "build") {
    if (!options.build) {
      return { ok: false, status: 409, error: "Anchored doesn't draft this job yet. Use a tool you have, or sign up for one, instead." };
    }
    return { ok: true, choice: { path: "build", skills: options.build.skills } };
  }
  if (request.path === "skip" || !("toolId" in request)) return { ok: true, choice: { path: "skip" } };

  const tool = toolById(request.toolId);
  if (!tool || !tool.workflows.includes(request.workflow)) return { ok: false, status: 400, error: "That tool doesn't cover this workflow." };
  const owned = options.owned.some((ownedTool) => ownedTool.id === tool.id);
  if (request.path === "turnon" && !owned) return { ok: false, status: 400, error: "That isn't a tool you already use. Sign up for it instead." };
  // A tool the business already pays for is always a turn-on, even if the request said buy.
  return { ok: true, choice: { path: owned ? "turnon" : "buy", toolId: tool.id } };
}
