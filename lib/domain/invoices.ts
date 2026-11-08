import { amountsIn, money } from "@/lib/domain/details";
import type { InvoiceRef } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The rules Bookkeeping follows, in plain code with no I/O. `readInvoiceMessage`
// reads an owner's words, such as "Sam Lee owes $240 on invoice 1042, due Oct 20"
// or "Sam paid 1042", into facts and lists what's missing; `followUpQuestion`
// asks for it. `invoiceKey` names one invoice so its reminders can be counted,
// and `canRemind` stops a third one. `checkReminderDraft` refuses a reminder
// whose numbers didn't come from the invoice or that adds a fee or a threat.
// `matchPaidInvoice` finds the invoice a payment settles, and asks when a
// customer has two open. `priceChange` compares a supplier's old and new price. Every value here comes
// from the owner's words or the invoice; nothing is guessed.

/** The most reminders one invoice ever gets. */
export const MAX_REMINDERS = 2;

/** What code read about one invoice. Each field is `null` when the words didn't say. */
export interface InvoiceFacts {
  /** The customer, as the owner wrote them, such as "Sam Lee". */
  readonly name: string | null;
  /** In dollars. */
  readonly amount: number | null;
  /** The invoice number as written, such as "1042" or "INV-1042". */
  readonly number: string | null;
  /** The due date exactly as written, such as "Oct 20". Kept as text so no time zone can shift it. */
  readonly due: string | null;
}

/** A fact a reminder or a payment can't go ahead without. */
export type MissingFact = "name" | "amount" | "invoice";

/** What one owner message says about money owed. */
export type InvoiceMessage =
  | { readonly kind: "owed"; readonly facts: InvoiceFacts; readonly missing: readonly MissingFact[] }
  | { readonly kind: "paid"; readonly facts: InvoiceFacts; readonly missing: readonly MissingFact[] }
  | { readonly kind: "none" };

// "hasn't paid" says money is owed, so these are checked before the paid words.
const OWED_WORDS =
  /\b(?:owes?|owed|owing|unpaid|overdue|past due|outstanding|hasn'?t paid|has not paid|didn'?t pay|did not pay|not paid|still due|behind on)\b/i;
const PAID_WORDS = /\b(?:paid|settled|cleared|payment (?:came in|received|cleared)|got (?:the )?payment|paid up|paid in full)\b/i;

// Invoice numbers, most specific first. Each must hold a digit, so "invoice for $240" finds no number.
const NUMBER_PATTERNS: readonly RegExp[] = [
  /#\s?([A-Z]{0,4}-?\d{1,10})\b/i,
  /\binvoice\s+(?:no\.?\s*|number\s+)?([A-Z]{0,4}-?\d{1,10})\b/i,
  /\b(INV-?\d{1,10})\b/i,
];
// In a paid message a bare number is the invoice: "Sam paid 1042", "1042 is settled". A "$" before it makes it money.
const BARE_PAID_NUMBER = [/\b(?:paid|settled|cleared)\s+(?:for\s+|on\s+)?(\d{3,10})\b(?!\s*dollars?)/i, /^\s*(\d{3,10})\s+(?:is|was|has been)\s+(?:paid|settled|cleared)\b/i];

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DUE = new RegExp(`\\bdue\\s+(?:on\\s+|since\\s+|by\\s+)?(${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|\\d{4}-\\d{2}-\\d{2})`, "i");

// Up to four capitalized words right before the verb: "Sam Lee owes", "Maya Chen paid", "The Lewis family hasn't paid".
const NAME_BEFORE =
  /((?:[A-Z][a-zA-Z'.-]*)(?:\s+(?:[A-Z][a-zA-Z'.-]*|family|and|&)){0,3})\s+(?:still\s+|just\s+|finally\s+|already\s+)?(?:owes?|owed|has|hasn'?t|didn'?t|did|paid|settled|is|was)\b/;
// Words that start a sentence but are never the customer.
const NOT_A_NAME = new Set(["I", "It", "The", "This", "That", "Invoice", "Inv", "Hey", "Hi", "Please", "Can", "They", "He", "She", "We", "My", "Our"]);

/** Read an owner's message for an invoice owed or paid, or `none` when it's about something else. */
export function readInvoiceMessage(text: string): InvoiceMessage {
  const words = text.trim().slice(0, 600);
  if (words === "") return { kind: "none" };
  const owed = OWED_WORDS.test(words);
  const paid = !owed && PAID_WORDS.test(words);
  if (!owed && !paid) return { kind: "none" };

  const amounts = amountsIn(words);
  const facts: InvoiceFacts = {
    name: readName(words),
    // Two different amounts leave code unsure which is owed, so it asks rather than picks.
    amount: new Set(amounts).size === 1 ? (amounts[0] ?? null) : null,
    number: readNumber(words, paid),
    due: words.match(DUE)?.[1]?.trim() ?? null,
  };

  if (owed) {
    const missing: MissingFact[] = [];
    if (facts.name === null) missing.push("name");
    if (facts.amount === null) missing.push("amount");
    return { kind: "owed", facts, missing };
  }
  // A payment needs something to match an invoice by: its number, or the customer's name.
  return { kind: "paid", facts, missing: facts.number === null && facts.name === null ? ["invoice"] : [] };
}

/**
 * Whether an owner's message is about one of their invoices, rather than money the business itself paid or
 * owes. "Sam owes $240" and "invoice 1042 is settled" are; "we paid $300 for ads" and "rent is overdue" aren't.
 */
export function talksAboutInvoice(message: InvoiceMessage, text: string): boolean {
  if (message.kind === "none") return false;
  const { name, number, amount } = message.facts;
  if (name !== null || number !== null || /\binvoices?\b|\bbills?\b/i.test(text)) return true;
  // "Someone owes me $200" is still a customer's debt; an amount alone never makes a payment the business's invoice.
  return message.kind === "owed" && amount !== null;
}

/** The question Anchored asks when an owner's message leaves out a fact it needs. */
export function followUpQuestion(message: Exclude<InvoiceMessage, { kind: "none" }>): string | null {
  const { missing, facts } = message;
  if (missing.length === 0) return null;
  if (message.kind === "paid") return "Which invoice was paid? Tell me the customer's name or the invoice number.";
  const who = facts.name ?? "they";
  if (missing.includes("name") && missing.includes("amount")) return "Who owes you, and how much? For example: \"Sam Lee owes $240 on invoice 1042.\"";
  if (missing.includes("name")) return `Who owes the ${facts.amount === null ? "money" : money(facts.amount)}?`;
  return facts.name === null ? "How much is owed?" : `How much does ${who} owe? I'll only use the amount you give me.`;
}

/** A stable name for one invoice, so its reminders can be counted: the number, else email or name plus amount. `null` when nothing identifies it. */
export function invoiceKey(invoice: { readonly number?: string | null; readonly email?: string | null; readonly name?: string | null; readonly amount?: number | null }): string | null {
  const number = invoice.number?.trim();
  // "INV-1042", "#1042" and "1042" are the same invoice.
  if (number) return `n:${number.replace(/^#/, "").replace(/^[A-Z]+-?(?=\d)/i, "").toLowerCase()}`;
  const amount = invoice.amount ?? null;
  if (amount === null) return null;
  const email = invoice.email?.trim().toLowerCase();
  if (email) return `e:${email}:${amount.toFixed(2)}`;
  const name = invoice.name?.trim().toLowerCase().replace(/\s+/g, " ");
  return name ? `p:${name}:${amount.toFixed(2)}` : null;
}

/** A reminder already drafted, as far as the cap cares. */
export interface ReminderRecord {
  readonly invoiceKey: string | null;
  readonly status: "pending" | "approved" | "skipped" | "superseded";
}

/** How many reminders `key` has had: the ones waiting and the ones the owner approved. Skipped and replaced ones don't count. */
export function remindersFor(records: readonly ReminderRecord[], key: string): number {
  return records.filter((record) => record.invoiceKey === key && (record.status === "pending" || record.status === "approved")).length;
}

/** Whether `key` may get another reminder. An invoice nothing identifies gets none, since its reminders can't be counted. */
export function canRemind(records: readonly ReminderRecord[], key: string | null): boolean {
  return key !== null && remindersFor(records, key) < MAX_REMINDERS;
}

/** The answer of a reminder check: fine, or the owner-facing reason it isn't. */
export type DraftCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

// Words that make a reminder a threat or add a charge Anchored never adds.
const PRESSURE =
  /\blate[- ]fees?\b|\bpenalt(?:y|ies)\b|\binterest (?:charge|fee|will|of)\b|\bcollections?\b|\blegal action\b|\blawyers?\b|\battorneys?\b|\bcourt\b|\bfinal (?:notice|warning)\b|\bor else\b|\bsuspend(?:ed)? your\b|\bsurcharge\b/i;

/** Check a reminder's words against its invoice: one amount, the invoice's own numbers, no fee and no threat. */
export function checkReminderDraft(body: string, invoice: InvoiceFacts, allowed: readonly string[] = []): DraftCheck {
  const pressure = body.match(PRESSURE);
  if (pressure) return { ok: false, reason: `Reminders never mention "${pressure[0]}". Anchored keeps them friendly.` };

  const amounts = amountsIn(body);
  if (amounts.length > 0 && invoice.amount === null) return { ok: false, reason: "The draft names an amount, but the invoice gave none." };
  const wrong = amounts.find((value) => invoice.amount === null || Math.abs(value - invoice.amount) > 0.005);
  if (wrong !== undefined) return { ok: false, reason: `The draft says ${money(wrong)}, but the invoice is for ${money(invoice.amount ?? 0)}.` };

  // Every other number must come from the invoice or from text the caller vouches for, such as the business name.
  const known = [invoice.number ?? "", invoice.due ?? "", invoice.amount === null ? "" : String(invoice.amount), ...allowed].join(" ");
  const knownDigits = new Set((known.match(/\d+/g) ?? []).map(stripZeros));
  if (invoice.amount !== null) for (const part of invoice.amount.toFixed(2).split(".")) knownDigits.add(stripZeros(part));
  const stray = (body.replace(/,(?=\d{3}\b)/g, "").match(/\d+/g) ?? []).find((digits) => !knownDigits.has(stripZeros(digits)));
  if (stray !== undefined) return { ok: false, reason: `The draft has the number ${stray}, which isn't on the invoice.` };
  return { ok: true };
}

/** A card as the payment rules read it: a reminder carries its invoice. */
export interface InvoiceCard {
  readonly skill: string | null;
  readonly status: ReminderRecord["status"];
  readonly invoice?: InvoiceRef;
}

/** The reminders among `cards`, in the shape `canRemind` counts. */
export function reminderRecords(cards: readonly InvoiceCard[]): ReminderRecord[] {
  return cards.flatMap((card) => (card.skill === "nudger" && card.invoice ? [{ invoiceKey: card.invoice.key, status: card.status }] : []));
}

/** Which invoice a payment settles: one key, nothing open to match, or several the owner must choose between. */
export type PaidMatch =
  | { readonly kind: "match"; readonly key: string }
  | { readonly kind: "none" }
  | { readonly kind: "ambiguous"; readonly options: readonly string[] };

/**
 * Find the invoice a payment settles. A number, or an email or name with the amount, names it directly. A name
 * alone matches the customer's one open reminder; two open invoices for that customer make the owner choose.
 */
export function matchPaidInvoice(cards: readonly InvoiceCard[], paid: { readonly number?: string | null; readonly email?: string | null; readonly name?: string | null; readonly amount?: number | null }): PaidMatch {
  const direct = invoiceKey(paid);
  if (direct !== null) return { kind: "match", key: direct };
  const name = paid.name?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!name) return { kind: "none" };
  const open = new Map<string, InvoiceRef>();
  for (const card of cards) {
    if (card.skill !== "nudger" || !card.invoice || card.invoice.customer !== name) continue;
    if (card.status === "pending" || card.status === "approved") open.set(card.invoice.key, card.invoice);
  }
  const refs = [...open.values()];
  if (refs.length === 0) return { kind: "none" };
  if (refs.length === 1) return { kind: "match", key: refs[0]?.key ?? "" };
  return { kind: "ambiguous", options: refs.map((ref) => (ref.number ? `invoice ${ref.number}` : `the ${money(ref.amount)} invoice`)) };
}

/** How a supplier's price moved. */
export interface PriceChange {
  readonly direction: "up" | "down" | "same";
  /** New price minus old, in dollars, rounded to cents. */
  readonly difference: number;
  /** The change as a percent of the old price, to one decimal. */
  readonly percent: number;
}

/** Compare a supplier's old and new price, or `null` when either is missing or not a real price. */
export function priceChange(oldPrice: number | null | undefined, newPrice: number | null | undefined): PriceChange | null {
  if (oldPrice == null || newPrice == null || !Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice <= 0 || newPrice < 0) return null;
  const difference = Math.round((newPrice - oldPrice) * 100) / 100;
  const percent = Math.round((difference / oldPrice) * 1000) / 10;
  return { direction: difference > 0 ? "up" : difference < 0 ? "down" : "same", difference, percent };
}

/** Whether a supplier raised its price. */
export function isPriceIncrease(oldPrice: number | null | undefined, newPrice: number | null | undefined): boolean {
  return priceChange(oldPrice, newPrice)?.direction === "up";
}

function readName(text: string): string | null {
  const match = text.match(NAME_BEFORE)?.[1];
  if (!match) return null;
  // Drop leading words that aren't the customer: "Hey Sam Lee owes" keeps "Sam Lee".
  const parts = match.split(/\s+/);
  while (parts.length > 0 && NOT_A_NAME.has(parts[0] ?? "")) parts.shift();
  const name = parts.join(" ").replace(/[.,]+$/, "").trim();
  return name === "" || NOT_A_NAME.has(name) ? null : name.slice(0, 80);
}

function readNumber(text: string, paid: boolean): string | null {
  for (const pattern of NUMBER_PATTERNS) {
    const found = text.match(pattern)?.[1];
    if (found) return found.toUpperCase();
  }
  if (!paid) return null;
  for (const pattern of BARE_PAID_NUMBER) {
    const found = text.match(pattern)?.[1];
    if (found) return found;
  }
  return null;
}

function stripZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}
