import type { RewriteResponse } from "@/lib/api/contract";
import { LlmRefusalError, LlmResponseError } from "@/lib/llm";
import { isAiConfigured, rewriteInVoice } from "@/lib/server/ai";
import { AiBudgetError } from "@/lib/server/ai-budget";
import { findBusiness, isCardId, isCardLive, materializeCard } from "@/lib/server/data";
import { saveRewrite } from "@/lib/server/decide";
import { fail, handleError, json } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/cards/[id]/rewrite redrafts a pending text or email in the owner's
// voice with the configured AI provider. The rewrite marks the card as edited,
// so the edit rate counts it like an owner's own change.

/** Rewrite a pending card's body in the owner's voice. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAiConfigured()) return fail(503, "No AI provider is set up on this server yet, so the draft stays as written.");
  try {
    const { id } = await params;
    if (!isCardId(id)) return fail(404, "Card not found. It may have been reset.");
    const card = await materializeCard(id);
    if (!card) return fail(404, "Card not found. It may have been reset.");
    if (card.status !== "pending") return fail(409, "This card was already decided.");
    if (!(await isCardLive(card))) return fail(409, "This workflow no longer uses that agent. Reload to see your current cards.");
    if (card.channel !== "sms" && card.channel !== "email") return fail(400, "Only texts and emails can be rewritten.");
    const business = await findBusiness(card.businessId);
    if (!business) return fail(404, "Business not found. It may have been reset.");

    const body = await rewriteInVoice(business, card.body);
    // The model call takes seconds; if the owner decided the card meanwhile, its sent text must not change.
    const updated = await saveRewrite(await getSessionId(), card.id, body);
    if (!updated) return fail(409, "This card was decided while it was being rewritten. Nothing changed.");
    return json<RewriteResponse>({ card: updated });
  } catch (error) {
    if (error instanceof AiBudgetError) return fail(429, "Anchored has used today's AI rewrites. Edit the draft yourself, or try again tomorrow.");
    if (error instanceof LlmRefusalError) return fail(422, "The AI model couldn't rewrite this one. Edit it yourself instead.");
    if (error instanceof LlmResponseError) return fail(422, "The rewrite changed facts in the draft, so it was thrown away. Edit it yourself instead.");
    return handleError(error, "POST /api/cards/[id]/rewrite");
  }
}
