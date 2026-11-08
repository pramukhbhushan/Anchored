import type { SetChoiceResponse } from "@/lib/api/contract";
import { setChoiceSchema } from "@/lib/api/schemas";
import { toolById } from "@/lib/domain/catalog";
import { pathOptions, workflowIdsOf } from "@/lib/domain/paths";
import type { Choice } from "@/lib/domain/types";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// PUT /api/businesses/[id]/choices sets the path for one workflow. The route
// checks the choice against the workflow's real options, so a request cannot
// turn on a tool the business doesn't own or build an agent that doesn't exist.

/** Save the owner's path for one workflow. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, setChoiceSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { id } = await params;
    const business = await findBusiness(id);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    const body = parsed.data;
    if (!workflowIdsOf(business).includes(body.workflow)) return fail(400, "That workflow isn't part of this business's plan.");

    const options = pathOptions(business, body.workflow);
    let choice: Choice;
    if (body.path === "build") {
      if (!options.build) return fail(409, "Anchored doesn't draft this job yet. Use a tool you have, or sign up for one, instead.");
      choice = { path: "build", skills: options.build.skills };
    } else if (body.path === "skip" || !("toolId" in body)) {
      choice = { path: "skip" };
    } else {
      const tool = toolById(body.toolId);
      if (!tool || !tool.workflows.includes(body.workflow)) return fail(400, "That tool doesn't cover this workflow.");
      const owned = options.owned.some((ownedTool) => ownedTool.id === tool.id);
      if (body.path === "turnon" && !owned) return fail(400, "That isn't a tool you already use. Sign up for it instead.");
      // A tool the business already pays for is always a turn-on, even if the request said buy.
      choice = { path: owned ? "turnon" : "buy", toolId: tool.id };
    }

    await getStore().setChoice(await getSessionId(), business.id, body.workflow, choice);
    return json<SetChoiceResponse>({ choice });
  } catch (error) {
    return handleError(error, "PUT /api/businesses/[id]/choices");
  }
}
