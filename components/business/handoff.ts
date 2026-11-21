import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Anchored isn't connected to the owner's texting, email or social accounts,
// so an approved draft goes out through the owner's own apps. `handOff` turns
// an approved draft into that last step: a link that opens the phone's texting
// app or the email app with the message typed out, or text to copy plus the
// places to paste it. The owner presses send there, so Anchored sends nothing itself.

/** A place the owner pastes copied text, such as their Instagram. */
interface PastePlace {
  readonly label: string;
  readonly href: string;
}

/** The owner's last step for one approved draft. */
export type HandOff =
  | { readonly kind: "open"; readonly label: string; readonly href: string }
  | { readonly kind: "copy"; readonly what: string; readonly text: string; readonly hint: string; readonly places: readonly PastePlace[] };

/** What the hand-off reads from the business. */
export type HandOffBusiness = Pick<BusinessProfile, "name" | "reach" | "tools">;

/** An approved draft: the text the owner approved, and the card fields that say where it goes. */
export interface ApprovedDraft {
  readonly channel: OutboxEntry["channel"] | "telegram";
  readonly to: string;
  readonly body: string;
  readonly title: string;
  /** The card's action, such as "Send text", "Send to 38 customers" or "Copy post". */
  readonly action: string;
}

const PHONE = /^\+?[0-9 ().-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GOOGLE: PastePlace = { label: "Open your Google listing", href: "https://business.google.com/" };
const INSTAGRAM: PastePlace = { label: "Open Instagram", href: "https://www.instagram.com/" };
const FACEBOOK: PastePlace = { label: "Open Facebook", href: "https://www.facebook.com/" };

/** Return who a send-to-many action reaches, such as "118 customers", or `null` for a single recipient. */
export function massAudience(action: string): string | null {
  return /^send to (.+)$/i.exec(action.trim())?.[1] ?? null;
}

/** Return what a "Copy post" or "Copy reply" action copies, such as "post", or `null` for an action that sends. */
export function copiedThing(action: string): string | null {
  return /^copy (.+)$/i.exec(action.trim())?.[1]?.toLowerCase() ?? null;
}

/** Return the words to post from a post card's body, without the "Draft post for ...:" lead-in or the quotes. */
function postText(body: string): string {
  const trimmed = body.trim();
  return /^Draft post\b[^"]*"([\s\S]+)"$/.exec(trimmed)?.[1] ?? trimmed;
}

/** Return the text a copy card puts on the clipboard. */
export function copyTextFor(action: string, body: string): string {
  return copiedThing(action) === "post" ? postText(body) : body.trim();
}

/** Return an `sms:` link that opens the texting app with `body` typed out, to `to` when it is a phone number. */
function smsHref(to: string, body: string): string {
  const number = PHONE.test(to.trim()) ? to.replace(/[^0-9+]/g, "") : "";
  // `?&body=` is the one form both iPhone and Android read; each ignores the separator it doesn't use.
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

/** Return a `mailto:` link that opens the email app with `body` typed out, addressed when `to` is an address. */
function mailtoHref(to: string, businessName: string, body: string): string {
  const address = EMAIL.test(to.trim()) ? encodeURIComponent(to.trim()) : "";
  return `mailto:${address}?subject=${encodeURIComponent(`A note from ${businessName}`)}&body=${encodeURIComponent(body)}`;
}

/** Whether the owner said customers find them on Google or that they keep a Google Business Profile. */
function usesGoogle(business: HandOffBusiness): boolean {
  return business.reach.includes("Google") || business.tools.includes("Google Business Profile");
}

/** Return where a post can go, from the places the owner said customers find them; a Google post lists Google first. */
function postPlaces(business: HandOffBusiness, title: string): PastePlace[] {
  const google = usesGoogle(business) ? [GOOGLE] : [];
  const social = business.reach.includes("Instagram or Facebook") ? [INSTAGRAM, FACEBOOK] : [INSTAGRAM];
  return /google/i.test(title) ? [...google, ...social] : [...social, ...google];
}

/** Return the approved draft behind an outbox entry, or `null` for a list entry whose card left the feed. */
export function approvedDraft(entry: Omit<OutboxEntry, "channel"> & Pick<ApprovedDraft, "channel">, card: Pick<CardRecord, "body" | "title" | "action"> | undefined): ApprovedDraft | null {
  if (card === undefined) return entry.channel === "list" ? null : { channel: entry.channel, to: entry.to, body: entry.body, title: "", action: "" };
  // A list entry logs "action: body", so the card holds the words the owner approved.
  return { channel: entry.channel, to: entry.to, body: entry.channel === "list" ? card.body : entry.body, title: card.title, action: card.action };
}

/** Return the owner's last step for an approved draft, or `null` when it stays inside Anchored, such as a rep list. */
export function handOff(draft: ApprovedDraft, business: HandOffBusiness): HandOff | null {
  // Only Anchored's connected bot can send to this chat. A personal app is not a safe fallback.
  if (draft.channel === "telegram") return null;
  if (draft.channel === "sms") {
    // A group text from a personal phone has no consent records behind it, so a send to many goes through a texting service.
    if (massAudience(draft.action) !== null) {
      return { kind: "copy", what: "text", text: draft.body, hint: "Paste it into the texting service that keeps your customer list.", places: [] };
    }
    return { kind: "open", label: "Send from your phone", href: smsHref(draft.to, draft.body) };
  }
  if (draft.channel === "email") {
    return { kind: "open", label: "Send from your email", href: mailtoHref(draft.to, business.name, draft.body) };
  }
  const thing = copiedThing(draft.action);
  if (thing === null) return null;
  const text = copyTextFor(draft.action, draft.body);
  if (thing === "post") return { kind: "copy", what: thing, text, hint: "Paste it into a new post.", places: postPlaces(business, draft.title) };
  if (thing === "reply") return { kind: "copy", what: thing, text, hint: "Paste it as your reply to the review.", places: usesGoogle(business) ? [GOOGLE] : [] };
  return { kind: "copy", what: thing, text, hint: "", places: [] };
}
