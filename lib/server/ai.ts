import "server-only";
import { voiceSample } from "@/lib/domain/details";
import { OPT_OUT_LINE } from "@/lib/domain/executor";
import type { BusinessProfile } from "@/lib/domain/types";
import { LlmConfigError, LlmResponseError } from "@/lib/llm";
import { tierForTask } from "@/lib/llm/task-tier";
import { getBusinessLlm } from "@/lib/server/business-llm";

// =============================================================================
// Module Overview
// =============================================================================
// `rewriteInVoice` redrafts a card in the owner's voice on the business's own
// AI key, written once against the provider-agnostic model layer. The model
// only writes words; code checks the reply for facts the draft didn't have and
// restores the opt-out line.

export { aiSetup, isAiConfigured } from "@/lib/server/business-llm";

/** Return the provider for `session`'s work on `businessId`, or throw when the business has no AI key. */
async function requireLlm(session: string, businessId: string) {
  const llm = await getBusinessLlm(session, businessId);
  if (!llm) throw new LlmConfigError("No AI key: the business has none on Connections.");
  return llm;
}

// =============================================================================
// Cards: redraft a message in the owner's voice
// =============================================================================

/** Return `body` rewritten in the owner's voice, on the business's own AI key when it has one, keeping every fact and the opt-out line. */
export async function rewriteInVoice(session: string, business: BusinessProfile, body: string): Promise<string> {
  const prompt = `Rewrite the message inside <message> so it sounds like the owner of ${business.name}, a ${business.trade}. Their voice sample is inside <voice>. Keep every fact, name, time and amount exactly. Do not add prices, offers or promises. Keep it under 60 words. Reply with only the rewritten message.

<voice>${voiceSample(business)}</voice>

<message>${body}</message>`;

  const text = plainPunctuation(await (await requireLlm(session, business.id)).generateText({ tier: tierForTask("short_reword"), prompt, maxTokens: 1000 })).slice(0, 600);
  const added = newFacts(body, text);
  if (added.length > 0) throw new LlmResponseError(`The rewrite added details that weren't in the draft: ${added.join(", ")}.`);
  // The opt-out line is a texting rule, so code restores it if the rewrite dropped it.
  return body.includes(OPT_OUT_LINE) && !text.includes(OPT_OUT_LINE) ? `${text} ${OPT_OUT_LINE}` : text;
}

/** Model text in house punctuation: straight quotes, no wrapping quotes, and any long dash turned into a comma. */
export function plainPunctuation(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .replace(/^"(.*)"$/s, "$1")
    .replace(/\s*[\u2013\u2014]\s*/g, ", ")
    .trim();
}

// Links, emails, phone numbers, money and other numbers are facts a rewrite must not invent.
const FACT_PATTERNS: readonly RegExp[] = [/https?:\/\/\S+|www\.\S+/gi, /[\w.+-]+@[\w-]+\.[\w.]+/g, /\$\s?\d[\d,.]*/g, /\d[\d\s().-]{5,}\d/g, /\d+(?:[.,:]\d+)*/g];

/** Return the links, emails, phone numbers, amounts and numbers in `rewritten` that `original` doesn't contain. */
export function newFacts(original: string, rewritten: string): string[] {
  const squash = (value: string) => value.replace(/[\s().-]/g, "").toLowerCase();
  const known = squash(original);
  const added = new Set<string>();
  for (const pattern of FACT_PATTERNS) {
    for (const match of rewritten.match(pattern) ?? []) {
      // Punctuation after an amount ends the sentence; "$89," states the same fact as "$89".
      const fact = match.trim().replace(/[.,]+$/, "");
      if (fact !== "" && !known.includes(squash(fact))) added.add(fact);
    }
  }
  return [...added];
}
