import type { RewriteResponse } from "@/lib/api/contract";
import { LlmRefusalError } from "@/lib/llm";
import { isAiConfigured, rewriteInVoice } from "@/lib/server/ai";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/cards/[id]/rewrite redrafts a pending text or email in the owner's
// voice with the configured AI provider. The rewrite marks the card as edited, so the edit rate
// counts it like an owner's own change.

/** Rewrite a pending card's body in the owner's voice. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAiConfigured()) return fail(503, "No AI provider is set up on this server yet, so the draft stays as written.");
  try {
    const session = await getSessionId();
    const store = getStore();
    const card = await store.getCard(session, (await params).id);
    if (!card) return fail(404, "Card not found. It may have been reset.");
    if (card.status !== "pending") return fail(409, "This card was already decided.");
    if (card.channel !== "sms" && card.channel !== "email") return fail(400, "Only texts and emails can be rewritten.");
    const business = await findBusiness(card.businessId);
    if (!business) return fail(404, "Business not found. It may have been reset.");

    const body = await rewriteInVoice(business, card.body);
    const updated = await store.updateCard(session, card.id, { body, edited: true });
    return json<RewriteResponse>({ card: updated });
  } catch (error) {
    if (error instanceof LlmRefusalError) return fail(422, "The AI model couldn't rewrite this one. Edit it yourself instead.");
    return handleError(error, "POST /api/cards/[id]/rewrite");
  }
}
