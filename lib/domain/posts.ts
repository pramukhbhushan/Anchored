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
// the owner never stated, such as "award-winning" or "guaranteed". `readBrief`
// splits the owner's intro into what the post is about and how they want it
// written, so an instruction like "Draft only" never lands in a caption.

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

// =============================================================================
// The owner's brief
// =============================================================================

/** The one question Anchored asks before a post: the owner's answer, with their photos, is the post's brief. */
export const POST_BRIEF_QUESTION = "Can you give a brief intro about what your post is going to be about?";

/** The owner's intro, split into what the post is about and how they want it written. */
export interface PostBrief {
  /** What happened or what the photos show, in the owner's words. Captions draw facts only from here. */
  readonly about: string;
  /** How the owner wants it written, such as "Use a warm, factual tone". Never copied into a caption. */
  readonly asks: readonly string[];
}

// A short label before the brief, such as "Marketing test:" or "Post idea:".
const LABEL = /^(?:[A-Za-z]+\s){0,2}[A-Za-z]+:\s+/;

// A sentence that tells the writer how to write instead of saying what happened.
const ASK_OPENER =
  /^(?:please\s+|pls\s+|can you\s+|could you\s+)?(?:use|make|write|keep|draft|do not|don't|dont|avoid|never|include|mention|add|focus|sound|be|try|put|give|create|turn|help|post|share|tag|end|start|open)\b/i;
const ASK_ANYWHERE = /\btone\b|\bdraft only\b|\bthe goal is\b|\bhashtags?\b|\bcaptions?\b|\bcarousel\b|\bemojis?\b|\bdo not\b|\bdon't\b/i;

// "These three photos show ..." becomes what they show.
const PHOTOS_SHOW = /^(?:these|the|our|this|my|here are|here's)\s+(?:\w+\s+)?(?:photos?|pictures?|pics|images?|shots?)\s+(?:show|shows|are of|is of|of|from)\s+/i;

// The topic inside an ask, such as "about a classroom event" in "Make a carousel caption about a classroom event".
const ABOUT_TOPIC = /\b(?:about|of|for|from)\s+((?:a|an|the|our|my)\s+[^,.;]{3,80})$/i;

/** Split the owner's intro into what the post is about and how they want it written. */
export function readBrief(text: string): PostBrief {
  const sentences = text.replace(/\s+/g, " ").trim().replace(LABEL, "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s !== "");
  const about: string[] = [];
  const asks: string[] = [];
  for (const raw of sentences) {
    const s = raw.replace(LABEL, "");
    if (ASK_OPENER.test(s) || ASK_ANYWHERE.test(s)) {
      asks.push(s);
      const topic = ABOUT_TOPIC.exec(s.replace(/[.!?]+$/, ""))?.[1];
      if (topic !== undefined && !/\b(?:caption|post|hashtag|tone)s?\b/i.test(topic)) about.push(sentence(topic));
    } else {
      about.push(sentence(s.replace(PHOTOS_SHOW, "")));
    }
  }
  return { about: about.join(" "), asks };
}

/** Report whether `brief` says enough about the post to write from: a few words of what happened. */
export function briefIsUsable(brief: PostBrief): boolean {
  return brief.about.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length >= 2;
}

// Asking for help with posts or marketing, in words the request reader doesn't treat as one draft.
const POST_TOPIC = /\b(?:carousel|social (?:media )?posts?|instagram|facebook|linkedin|tiktok)\b/i;
const PHOTO_WORDS = /\b(?:photos?|pictures?|pics|images?)\b/i;
const POST_WORDS = /\b(?:posts?|captions?)\b/i;
const MARKETING_HELP = /\bmarketing\b.*\b(?:help|problem|priority|struggl\w*|need)\b|\b(?:help|problem|priority|struggl\w*|need)\b.*\bmarketing\b/i;
const WANTS_WORK = /\b(?:help|make|create|write|draft|turn|need|want|can you|could you|how do i|let's)\b/i;

/** Report whether `text` asks for help making posts or with marketing, such as "please help us make a carousel". */
export function asksForPostHelp(text: string): boolean {
  if (MARKETING_HELP.test(text)) return true;
  if (!WANTS_WORK.test(text)) return false;
  return POST_TOPIC.test(text) || (POST_WORDS.test(text) && PHOTO_WORDS.test(text));
}

/** Report whether `text` asks for a post made from photos, such as "turn our event photos into a carousel". */
export function wantsPhotoPost(text: string): boolean {
  return asksForPostHelp(text) && (/\bcarousel\b/i.test(text) || PHOTO_WORDS.test(text));
}

/** Report whether `text`, one of Anchored's chat messages, asked the post question, so the owner's next message is a brief. */
export function askedForBrief(text: string): boolean {
  return text.includes(POST_BRIEF_QUESTION);
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

/**
 * Write one platform's caption from the plan and the owner's words alone. Only what the post is about goes in,
 * never how the owner asked for it to be written. It passes the hashtag check whenever the plan offers enough hashtags.
 */
export function ruleCaption(business: Pick<BusinessProfile, "name">, plan: PlatformPlan, description: string): string {
  const hook = plan.hooks.find((h) => !hasBlanks(h.text))?.text ?? "Proud of this one.";
  const rule = PLATFORM_RULES[plan.platform];
  const count = Math.min(Math.max(TEMPLATE_TAGS[plan.platform], rule.minHashtags), rule.maxHashtags, plan.hashtags.length);
  const tags = plan.hashtags.slice(0, count).join(" ");
  const { about } = readBrief(description);
  const middle = about === "" ? `A look at recent work from ${business.name}.` : about;
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
  { label: "a deal", pattern: /\b(?:discount|(?<!feel )free|% off|percent off|sale|coupon|deal)\b/i },
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
  // A hashtag starts with a letter, so "#1" stays in and the ranking check still sees it.
  const body = caption.replace(/#[A-Za-z][A-Za-z0-9_]*/g, "");
  return CLAIMS.filter((c) => c.pattern.test(body) && !c.pattern.test(source)).map((c) => c.label);
}
