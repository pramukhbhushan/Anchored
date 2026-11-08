import type { TradeKey } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The post playbook: proven post formats, hooks and hashtags for each niche and
// platform, which the Marketing agent writes posts from. The rows live in the
// `post_formats`, `post_hooks` and `post_hashtags` tables, seeded from
// `PLAYBOOK_SEED`. Code picks the format, the candidate hooks and the allowed
// hashtags here; the model only fills in the words from the owner's photos and
// description. `checkHashtags` refuses any hashtag code did not offer.

/** A social platform the Marketing agent writes captions for. */
export type PostPlatform = "instagram" | "facebook" | "linkedin";

/** Every platform, in the order cards show them. */
export const POST_PLATFORMS: readonly PostPlatform[] = ["instagram", "facebook", "linkedin"];

/** A niche the playbook is written for: a trade key, or `any` for formats that fit every business. */
export type PlaybookNiche = TradeKey;

/** Whether a format is one photo, a swipeable carousel, or works as either. */
export type PostMedia = "single" | "carousel" | "either";

/** One proven post format, such as a before and after carousel. */
export interface PostFormat {
  readonly id: string;
  readonly name: string;
  readonly niches: readonly PlaybookNiche[];
  readonly platforms: readonly PostPlatform[];
  readonly media: PostMedia;
  readonly minPhotos: number;
  readonly maxPhotos: number;
  /** Why the format gets attention, in one sentence. */
  readonly why: string;
  /** The beats of the post in order: one per slide for a carousel, or per paragraph for a single photo. */
  readonly structure: readonly string[];
  /** The photos to take for it, as an owner would read them. */
  readonly photoIdeas: readonly string[];
  /** Words in the owner's description that suggest this format, lowercase. */
  readonly cues: readonly string[];
}

/** An opening line pattern. `{braces}` mark words the model fills only from the owner's description. */
export interface PostHook {
  readonly id: string;
  readonly text: string;
  readonly niches: readonly PlaybookNiche[];
  readonly platforms: readonly PostPlatform[];
  /** Format ids the hook suits; empty means any format. */
  readonly formats: readonly string[];
}

/** A hashtag a caption may use. */
export interface PostHashtag {
  /** The tag with its `#`, such as `#HomeImprovement`. */
  readonly tag: string;
  readonly niches: readonly PlaybookNiche[];
  readonly platforms: readonly PostPlatform[];
  /** A lowercase word the business's trade must contain for the tag to apply, such as `hvac`; `null` for every trade. */
  readonly trade: string | null;
}

/** Every playbook row, as the store returns it. */
export interface PostPlaybook {
  readonly formats: readonly PostFormat[];
  readonly hooks: readonly PostHook[];
  readonly hashtags: readonly PostHashtag[];
}

/** Caption rules per platform, enforced in code. */
export interface PlatformRule {
  readonly label: string;
  readonly minHashtags: number;
  readonly maxHashtags: number;
  /** Longest caption, hashtags included, in characters. */
  readonly maxChars: number;
  /** How the caption should read, for the model's prompt. */
  readonly tone: string;
}

/** Caption rules for each platform. Instagram and Facebook read alike; LinkedIn runs longer and more professional. */
export const PLATFORM_RULES: Readonly<Record<PostPlatform, PlatformRule>> = {
  instagram: { label: "Instagram", minHashtags: 3, maxHashtags: 8, maxChars: 2200, tone: "Short, warm and visual. A hook line, two to four short lines, one call to action, then hashtags." },
  facebook: { label: "Facebook", minHashtags: 2, maxHashtags: 4, maxChars: 2000, tone: "Friendly and neighborly, like talking to locals. A hook line, a short paragraph, one call to action, then hashtags." },
  linkedin: { label: "LinkedIn", minHashtags: 3, maxHashtags: 5, maxChars: 3000, tone: "Professional and reflective. A hook line, a short story, what it shows about the work, a question or call to action, then hashtags." },
};

/** The stable id of a hashtag row in `post_hashtags`: its tag, trade word and niches. */
export function hashtagId(h: PostHashtag): string {
  return `${h.tag.toLowerCase()}|${h.trade ?? "*"}|${h.niches.join("+")}`;
}

// =============================================================================
// Selection
// =============================================================================

/** Report whether a row written for `niches` applies to a business in `niche`. */
function fitsNiche(niches: readonly PlaybookNiche[], niche: PlaybookNiche): boolean {
  return niches.includes(niche) || niches.includes("any");
}

/** Keep only the playbook rows that apply to a business in `niche`. */
export function playbookForNiche(playbook: PostPlaybook, niche: PlaybookNiche): PostPlaybook {
  return {
    formats: playbook.formats.filter((f) => fitsNiche(f.niches, niche)),
    hooks: playbook.hooks.filter((h) => fitsNiche(h.niches, niche)),
    hashtags: playbook.hashtags.filter((h) => fitsNiche(h.niches, niche)),
  };
}

/** Report whether a format can hold `photoCount` photos. */
export function fitsPhotoCount(format: PostFormat, photoCount: number): boolean {
  return photoCount >= format.minPhotos && photoCount <= format.maxPhotos;
}

/** Report whether lowercase `text` contains `cue` as whole words, so "or" never matches "work". */
function mentions(text: string, cue: string): boolean {
  const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

/** What the owner gave for one post. */
export interface PostRequest {
  readonly niche: PlaybookNiche;
  readonly platform: PostPlatform;
  readonly photoCount: number;
  readonly description: string;
}

/** Rank the formats that fit `request`, best first: description cues, then niche-specific over general, then id. */
export function pickFormats(playbook: PostPlaybook, request: PostRequest): PostFormat[] {
  const text = request.description.toLowerCase();
  const score = (format: PostFormat) =>
    format.cues.filter((cue) => mentions(text, cue)).length * 2 + (format.niches.includes(request.niche) ? 1 : 0);
  return playbook.formats
    .filter((f) => fitsNiche(f.niches, request.niche) && f.platforms.includes(request.platform) && fitsPhotoCount(f, request.photoCount))
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

/** List the hooks for `formatId` on `platform` in `niche`: hooks written for that format first, then general ones. */
export function hooksFor(playbook: PostPlaybook, formatId: string, platform: PostPlatform, niche: PlaybookNiche): PostHook[] {
  const usable = playbook.hooks.filter(
    (h) => fitsNiche(h.niches, niche) && h.platforms.includes(platform) && (h.formats.length === 0 || h.formats.includes(formatId)),
  );
  return [...usable.filter((h) => h.formats.length > 0), ...usable.filter((h) => h.formats.length === 0)];
}

/** Turn a place such as "College Park, MD" into a local hashtag such as `#CollegePark`, or `null` when nothing is left. */
export function localTag(place: string): string | null {
  const city = place.split(",")[0] ?? "";
  const words = city.match(/[A-Za-z0-9]+/g) ?? [];
  if (words.length === 0) return null;
  return `#${words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join("")}`;
}

/** List the hashtags a caption on `platform` may use: the niche's and trade's tags, plus the local tag. */
export function hashtagsFor(playbook: PostPlaybook, niche: PlaybookNiche, platform: PostPlatform, trade: string, place: string): string[] {
  const tradeText = trade.toLowerCase();
  const tags = playbook.hashtags
    .filter((h) => fitsNiche(h.niches, niche) && h.platforms.includes(platform) && (h.trade === null || tradeText.includes(h.trade)))
    // Trade tags first: they are the most specific.
    .sort((a, b) => Number(b.trade !== null) - Number(a.trade !== null))
    .map((h) => h.tag);
  const local = localTag(place);
  return [...new Set(local ? [local, ...tags] : tags)];
}

// =============================================================================
// Checks
// =============================================================================

/** Return every hashtag in `caption`, in order. */
export function hashtagsIn(caption: string): string[] {
  return caption.match(/#[A-Za-z0-9_]+/g) ?? [];
}

/** Why a caption fails its platform's hashtag and length rules, or `null` when it passes. */
export function checkHashtags(caption: string, platform: PostPlatform, allowed: readonly string[]): string | null {
  const rule = PLATFORM_RULES[platform];
  const tags = hashtagsIn(caption);
  if (caption.length > rule.maxChars) return `${rule.label} captions stop at ${rule.maxChars} characters.`;
  if (tags.length < rule.minHashtags) return `${rule.label} captions need at least ${rule.minHashtags} hashtags.`;
  if (tags.length > rule.maxHashtags) return `${rule.label} captions use at most ${rule.maxHashtags} hashtags.`;
  const allowedLower = new Set(allowed.map((t) => t.toLowerCase()));
  const unknown = tags.find((t) => !allowedLower.has(t.toLowerCase()));
  return unknown ? `${unknown} is not one of the hashtags offered for this post.` : null;
}
