import { PLATFORM_RULES, POST_PLATFORMS, hashtagsFor, hooksFor, pickFormats, type PostFormat, type PostHook, type PostPlatform, type PostPlaybook } from "@/lib/domain/playbook";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// A photo post: the owner's photos and one line about them, turned into a
// caption per platform. `planPost` decides in code which playbook format each
// platform uses, which hooks the writer may open with and which hashtags it may
// use. `ruleCaption` writes a caption from the plan alone, for when no model is
// set up or the model's caption fails a check. `unbackedClaims` refuses praise
// the owner never stated, such as "award-winning" or "guaranteed".

/** One photo in a post, in the order the owner wants it shown. */
export interface PostPhoto {
  readonly id: string;
  /** Where the app serves it to its owner. */
  readonly url: string;
}

/** Most photo posts one business may draft in a day, so a busy chat can't spend the model budget. */
export const MAX_POSTS_PER_DAY = 10;

/** Count the photo posts drafted in the 24 hours before `now`. */
export function postsInLastDay(cards: readonly { readonly post?: unknown; readonly createdAt: string }[], now: Date): number {
  const since = now.getTime() - 24 * 60 * 60 * 1000;
  return cards.filter((c) => c.post !== undefined && Date.parse(c.createdAt) > since).length;
}

/** A card title from the owner's words: "Post: " and the first words, cut at a word under 60 characters. */
export function postTitle(text: string): string {
  const words = text.replace(/\s+/g, " ").trim();
  if (words.length <= 60) return `Post: ${words}`;
  const cut = words.slice(0, 60);
  return `Post: ${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : 60).replace(/[,.;:]$/, "")}...`;
}

/** Who wrote a caption: the model, or the rules after the model was off or failed a check. */
export type CaptionSource = "ai" | "template";

/** A drafted photo post, as a card carries it. */
export interface PostDraft {
  /** The owner's own words about the photos. */
  readonly description: string;
  readonly photos: readonly PostPhoto[];
  /** The playbook format each platform's caption follows. */
  readonly formats: Readonly<Record<PostPlatform, { readonly id: string; readonly name: string }>>;
  readonly captions: Readonly<Record<PostPlatform, string>>;
  readonly written: Readonly<Record<PostPlatform, CaptionSource>>;
  /** A few words to lay over each photo of a carousel, in photo order; empty when there are none. */
  readonly slides: readonly string[];
}

/** What code decided for one platform's caption. */
export interface PlatformPlan {
  readonly platform: PostPlatform;
  readonly format: PostFormat;
  /** Opening lines the writer may use, best first. */
  readonly hooks: readonly PostHook[];
  /** The only hashtags the caption may use, the local tag first. */
  readonly hashtags: readonly string[];
}

/** The plan for every platform. */
export type PostPlan = Readonly<Record<PostPlatform, PlatformPlan>>;

/** Most hooks offered to the writer per platform, so the prompt stays short. */
const HOOKS_OFFERED = 5;

/** Plan each platform's caption from the playbook, the business and what the owner gave. */
export function planPost(playbook: PostPlaybook, business: Pick<BusinessProfile, "tradeKey" | "trade" | "place">, description: string, photoCount: number): PostPlan {
  const plan = {} as Record<PostPlatform, PlatformPlan>;
  for (const platform of POST_PLATFORMS) {
    const request = { niche: business.tradeKey, platform, photoCount, description };
    const format = pickFormats(playbook, request)[0] ?? GENERAL_FORMAT;
    plan[platform] = {
      platform,
      format,
      hooks: hooksFor(playbook, format.id, platform, business.tradeKey).slice(0, HOOKS_OFFERED),
      hashtags: hashtagsFor(playbook, business.tradeKey, platform, business.trade, business.place),
    };
  }
  return plan;
}

/** The format used when the playbook holds none that fits, such as an empty playbook. */
const GENERAL_FORMAT: PostFormat = {
  id: "general",
  name: "Photo post",
  niches: ["any"],
  platforms: POST_PLATFORMS,
  media: "either",
  minPhotos: 1,
  maxPhotos: 10,
  why: "A real photo with one clear line about it.",
  structure: ["The photo with a one-line hook", "What it shows", "How to reach the business"],
  photoIdeas: [],
  cues: [],
};

// =============================================================================
// The rules' caption
// =============================================================================

// How each platform's template caption closes. No phone, link or hours, so nothing is invented.
const CLOSING: Readonly<Record<PostPlatform, string>> = {
  instagram: "Send us a message to learn more.",
  facebook: "Questions? Send us a message, we're happy to help.",
  linkedin: "If you'd like to talk about work like this, send us a message.",
};

// How many hashtags a template caption uses on each platform, inside the platform's limits.
const TEMPLATE_TAGS: Readonly<Record<PostPlatform, number>> = { instagram: 5, facebook: 3, linkedin: 4 };

/** `text` with a capital first letter and closing punctuation, and no hashtags. */
function sentence(text: string): string {
  const plain = text.replace(/#/g, "").replace(/\s+/g, " ").trim();
  const capped = plain.charAt(0).toUpperCase() + plain.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/** Report whether a hook still has `{blanks}`, which only a writer with the owner's words can fill. */
export function hasBlanks(text: string): boolean {
  return /[{}]/.test(text);
}

/** Write one platform's caption from the plan and the owner's words alone. It always passes the hashtag check. */
export function ruleCaption(business: Pick<BusinessProfile, "name">, plan: PlatformPlan, description: string): string {
  const hook = plan.hooks.find((h) => !hasBlanks(h.text))?.text ?? "Proud of this one.";
  const rule = PLATFORM_RULES[plan.platform];
  const count = Math.min(Math.max(TEMPLATE_TAGS[plan.platform], rule.minHashtags), rule.maxHashtags, plan.hashtags.length);
  const tags = plan.hashtags.slice(0, count).join(" ");
  const about = description.trim() === "" ? `A look at recent work from ${business.name}.` : sentence(description);
  const middle = plan.platform === "linkedin" ? `${about}\n\nEvery job is a chance to do the work right, and this one was no different.` : about;
  return `${hook}\n\n${middle}\n\n${CLOSING[plan.platform]}\n\n${tags}`;
}

// =============================================================================
// Checks
// =============================================================================

// Praise a post may only repeat when the owner said it: awards, guarantees, rankings and credentials.
const CLAIMS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "an award", pattern: /\baward(?:s|-winning|ed)?\b/i },
  { label: "a guarantee", pattern: /\bguarantee(?:d|s)?\b|\bwarrant(?:y|ies|ied)\b/i },
  { label: "a ranking", pattern: /\bthe best\b|\bbest in\b|\btop[- ]rated\b|\bnumber one\b|#1\b|\bno\. 1\b|\bleading\b/i },
  { label: "a credential", pattern: /\b(?:certified|licensed|accredited|insured)\b/i },
  { label: "a deal", pattern: /\b(?:discount|free|% off|percent off|sale|coupon|deal)\b/i },
];

// Phrases that mark a caption as machine-written. The prompt asks the model to avoid them; code refuses the worst.
const AI_TELLS: readonly RegExp[] = [
  /\btestament to\b/i,
  /\belevat(?:e|es|ed|ing)\b/i,
  /\bdelv(?:e|es|ing)\b/i,
  /\bgame[- ]changer\b/i,
  /\bnestled\b/i,
  /\blook no further\b/i,
  /\bunlock(?:s|ing)?\b/i,
  /\bseamless(?:ly)?\b/i,
  /\bin today's\b/i,
  /\blet's dive\b|\bdive in(?:to)?\b/i,
  /\b(?:it's|it is|this is|we're|we are) (?:not just|more than just)\b/i,
  /\bmore than just\b/i,
  /\bwhether you're\b/i,
  /\bembark\b/i,
  /\btapestry\b/i,
  /\bbustling\b/i,
  /\bvibrant\b/i,
];

/** List the machine-sounding phrases in `caption`, as found. */
export function aiTells(caption: string): string[] {
  return AI_TELLS.flatMap((pattern) => caption.match(pattern)?.[0] ?? []);
}

/** List the claims `caption` makes that `source`, the owner's own words, doesn't. */
export function unbackedClaims(source: string, caption: string): string[] {
  const body = caption.replace(/#[A-Za-z0-9_]+/g, "");
  return CLAIMS.filter((c) => c.pattern.test(body) && !c.pattern.test(source)).map((c) => c.label);
}
