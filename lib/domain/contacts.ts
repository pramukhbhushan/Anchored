// =============================================================================
// Module Overview
// =============================================================================
// The business's customers as Anchored may contact them. A `Contact` carries
// where its consent came from and whether it texted STOP. `normalizePhone` reads
// a US number into one form, `optOutKeyword` reads STOP and START replies, and
// `deliveryFor` decides whether Anchored sends an approved message itself or
// leaves it for the owner to send from their own phone or email.

/** Where a customer's OK to get messages came from. `messaged-first` is recorded by the Telegram bot, never picked by hand. */
export type ConsentSource = "texted-first" | "messaged-first" | "web-form" | "in-person" | "paper" | "imported";

/** Each consent source as the owner reads it. */
export const CONSENT_LABEL: Readonly<Record<ConsentSource, string>> = {
  "texted-first": "Texted the business first",
  "messaged-first": "Messaged the business on Telegram first",
  "web-form": "Checked the box on a web form",
  "in-person": "Said yes in person",
  paper: "Signed a paper form",
  imported: "Imported with a consent record",
};

/** The consent sources an owner can record by hand, in the order the form lists them. */
export const CONSENT_SOURCES: readonly ConsentSource[] = ["texted-first", "web-form", "in-person", "paper", "imported"];

/** A customer the business may contact. */
export interface Contact {
  readonly id: string;
  readonly businessId: string;
  readonly name: string;
  /** E.164, such as "+13015550192", or `null`. */
  readonly phone: string | null;
  readonly email: string | null;
  /** Where the OK to get texts came from and when, or `null` when there is none on file. */
  readonly consent: { readonly source: ConsentSource; readonly at: string } | null;
  /** When the customer texted STOP or sent /stop, or `null`. A later START or /start clears it. */
  readonly optedOutAt: string | null;
  /** The customer's Telegram chat id, as a string so no digits are lost. Absent for contacts who never used the bot. */
  readonly telegramChatId?: string;
  /** The name the customer shows on Telegram, when they have one. */
  readonly telegramName?: string;
}

// =============================================================================
// Phone numbers and email addresses
// =============================================================================

/** Read a phone number into E.164, assuming a US number when no country code is given; `null` when it isn't one. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\+?[0-9 ().-]{7,24}$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Whether `raw` is one plain email address. */
export function isEmailAddress(raw: string): boolean {
  return /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[A-Za-z]{2,}$/.test(raw.trim());
}

// =============================================================================
// STOP and START
// =============================================================================

// The carriers' opt-out words, plus the FCC's 2025 additions. A reply that is only one of these counts.
const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout", "opt out", "stop all"]);
const START_WORDS = new Set(["start", "unstop", "resume"]);

/** Read a reply as an opt-out ("stop") or an opt-back-in ("start"), or `null` for any other message. */
export function optOutKeyword(text: string): "stop" | "start" | null {
  const word = text.trim().toLowerCase().replace(/[.!\s]+$/g, "").replace(/\s+/g, " ");
  if (STOP_WORDS.has(word)) return "stop";
  if (START_WORDS.has(word)) return "start";
  return null;
}

/** Return `contact` after a STOP or START reply at `at`. */
export function applyOptOut(contact: Contact, keyword: "stop" | "start", at: string): Contact {
  return { ...contact, optedOutAt: keyword === "stop" ? at : null };
}

/** The contact whose Telegram chat id is `chatId`, or `undefined`. */
export function contactByTelegramChat(contacts: readonly Contact[], chatId: string): Contact | undefined {
  return contacts.find((contact) => contact.telegramChatId === chatId);
}

/** The contact whose phone number is `phone`, in E.164, or `undefined`. */
export function contactByPhone(contacts: readonly Contact[], phone: string): Contact | undefined {
  return contacts.find((contact) => contact.phone === phone);
}

// =============================================================================
// Who sends an approved message
// =============================================================================

/** What the business has connected, as `deliveryFor` needs it. */
export interface SendingSetup {
  /** A texting number is connected. */
  readonly texting: boolean;
  /** Anchored can send email for the business. */
  readonly email: boolean;
}

/** Who sends an approved message: Anchored now, or the owner, with the reason Anchored can't. */
export type Delivery = { readonly by: "anchored"; readonly to: string } | { readonly by: "owner"; readonly reason: string | null };

/**
 * Decide whether Anchored sends an approved message itself. A text goes out only to a number with a consent
 * record and no STOP; an email only to a real address. Anything else stays the owner's to send, with the reason.
 */
export function deliveryFor(message: { readonly channel: string; readonly to: string }, setup: SendingSetup, contacts: readonly Contact[]): Delivery {
  if (message.channel === "sms") {
    if (!setup.texting) return { by: "owner", reason: null };
    const phone = normalizePhone(message.to);
    if (phone === null) return { by: "owner", reason: "This text has no phone number, so send it from your phone." };
    const contact = contactByPhone(contacts, phone);
    if (contact?.optedOutAt) return { by: "owner", reason: "This customer texted STOP. Anchored won't text them." };
    if (!contact?.consent) return { by: "owner", reason: "No texting OK on file for this number. Add it in Connections, or send it from your phone." };
    return { by: "anchored", to: phone };
  }
  if (message.channel === "email") {
    if (!setup.email) return { by: "owner", reason: null };
    if (!isEmailAddress(message.to)) return { by: "owner", reason: "This email has no address, so send it from your email." };
    return { by: "anchored", to: message.to.trim() };
  }
  return { by: "owner", reason: null };
}
