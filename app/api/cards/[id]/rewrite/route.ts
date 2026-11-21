import type { RewriteResponse } from "@/lib/api/contract";
import { LlmRefusalError, LlmResponseError } from "@/lib/llm";
import { isAiConfigured, rewriteInVoice } from "@/lib/server/ai";
import { AiBudgetError, AiKeyError } from "@/lib/server/ai-budget";
import { findBusiness, isCardId, isCardLive, materializeCard } from "@/lib/server/data";
import { saveRewrite } from "@/lib/server/decide";
import { fail, handleError, json } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/cards/[id]/rewrite redrafts a pending text or email in the owner's
// voice, on the business's own AI key or the server's. The rewrite marks the card as edited,
// so the edit rate counts it like an owner's own change.

const AI_OFF = "Add your AI key on Connections to rewrite drafts. Until then, edit the draft yourself.";
const AI_OFF_EXAMPLE = "The example business writes its drafts without AI. Set up your business and add your AI key to rewrite drafts.";

/** Rewrite a pending card's body in the owner's voice. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isCardId(id)) return fail(404, "Card not found. Reload to see your current cards.");
    const card = await materializeCard(id);
    if (!card) return fail(404, "Card not found. Reload to see your current cards.");
    if (card.status !== "pending") return fail(409, "This card was already decided.");
    if (!(await isCardLive(card))) return fail(409, "This workflow no longer uses that agent. Reload to see your current cards.");
    if (card.channel !== "sms" && card.channel !== "email") return fail(400, "Only texts and emails can be rewritten.");
    const business = await findBusiness(card.businessId);
    if (!business) return fail(404, "Business not found. It may have been deleted. Reload the page to see your businesses.");
    const session = await getSessionId();
    if (!(await isAiConfigured(session, business.id))) return fail(503, business.kind === "case" ? AI_OFF_EXAMPLE : AI_OFF);

    const body = await rewriteInVoice(session, business, card.body);
    // The model call takes seconds; if the owner decided the card meanwhile, its sent text must not change.
    const updated = await saveRewrite(session, card.id, body);
    if (!updated) return fail(409, "This card was decided while it was being rewritten. Nothing changed.");
    return json<RewriteResponse>({ card: updated });
  } catch (error) {
    if (error instanceof AiKeyError) return fail(422, error.message);
    if (error instanceof AiBudgetError) {
      const who = error.scope === "session" ? "You've" : "Anchored has";
      return fail(429, `${who} used today's AI rewrites. Edit the draft yourself, or try again tomorrow.`);
    }
    if (error instanceof LlmRefusalError) return fail(422, "The AI model couldn't rewrite this one. Edit it yourself instead.");
    if (error instanceof LlmResponseError) return fail(422, "The rewrite changed facts in the draft, so it was thrown away. Edit it yourself instead.");
    return handleError(error, "POST /api/cards/[id]/rewrite");
  }
}
