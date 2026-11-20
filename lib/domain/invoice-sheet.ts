import { invoiceKey } from "@/lib/domain/invoices";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's invoice spreadsheet, read in plain code with no I/O.
// `sheetIdFromText` finds a Google Sheets link in a chat message.
// `parseInvoiceRows` reads the rows under a header such as `Invoice #`,
// `Customer`, `Email`, `Amount`, `Due date`, `Status`, in any order and any
// case, and reports rows it can't read. `sheetEvents` turns each overdue unpaid
// row into an `invoice-late` event and each paid row into `invoice-paid`, the
// same events a webhook or the owner's chat send. `sheetSyncReply` says what a
// check found, in plain words. Every amount comes from a cell; nothing is guessed.

/** One invoice row as code read it. A field is `null` when its cell was empty or unreadable. */
export interface SheetInvoice {
  /** The spreadsheet row, counting the header as row 1, so the owner can find it. */
  readonly row: number;
  readonly number: string | null;
  readonly customer: string | null;
  readonly email: string | null;
  readonly amount: number;
  /** The due date as `YYYY-MM-DD`, or `null` when the cell was empty or not a date. */
  readonly due: string | null;
  readonly paid: boolean;
}

/** What `parseInvoiceRows` read: the invoices, rows it couldn't use, and required columns the header lacks. */
export interface ParsedSheet {
  readonly invoices: readonly SheetInvoice[];
  readonly problems: readonly string[];
  readonly missingColumns: readonly string[];
}

type Column = "number" | "customer" | "email" | "amount" | "due" | "status";

// The header names each column may go by, lowercased with single spaces.
const HEADERS: Readonly<Record<Column, readonly string[]>> = {
  number: ["invoice #", "invoice", "invoice number", "invoice no", "invoice no.", "inv #", "number", "#"],
  customer: ["customer", "client", "name", "customer name", "client name", "bill to"],
  email: ["email", "e-mail", "customer email", "client email", "email address"],
  amount: ["amount", "amount due", "total", "balance", "balance due", "invoice amount"],
  due: ["due date", "due", "date due", "due on"],
  status: ["status", "paid?", "paid", "payment status", "state"],
};

/** The ID in a Google Sheets link, such as the one an owner pastes in chat, or `null` when there is none. */
export function sheetIdFromText(text: string): string | null {
  return text.match(/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})/)?.[1] ?? null;
}

/** Whether an owner's message asks Anchored to read their invoice sheet again, such as "check my invoice sheet". */
export function asksToCheckSheet(text: string): boolean {
  return /\b(?:check|sync|refresh|read|update|look at|go through)\b.{0,30}\b(?:invoice|invoices|spreadsheet|sheet)\b/i.test(text);
}

/** Read an invoice sheet's rows. The first row is the header; empty rows are skipped. */
export function parseInvoiceRows(rows: readonly (readonly string[])[]): ParsedSheet {
  const header = rows[0] ?? [];
  const at = columnPositions(header);
  const missing: string[] = [];
  if (at.amount === undefined) missing.push("Amount");
  if (at.status === undefined) missing.push("Status");
  if (at.due === undefined) missing.push("Due date");
  if (at.number === undefined && at.customer === undefined && at.email === undefined) missing.push("Invoice # or Customer");
  if (missing.length > 0) return { invoices: [], problems: [], missingColumns: missing };

  const invoices: SheetInvoice[] = [];
  const problems: string[] = [];
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2;
    const cell = (column: Column) => {
      const position = at[column];
      const value = position === undefined ? "" : (cells[position] ?? "").trim();
      return value === "" ? null : value;
    };
    if (cells.every((value) => value.trim() === "")) return;
    const amountText = cell("amount");
    const amount = amountText === null ? null : readAmount(amountText);
    if (amount === null) {
      problems.push(amountText === null ? `Row ${row} has no amount, so I skipped it.` : `Row ${row}'s amount "${amountText}" isn't a number, so I skipped it.`);
      return;
    }
    const dueText = cell("due");
    const due = dueText === null ? null : readDate(dueText);
    if (dueText !== null && due === null) problems.push(`Row ${row}'s due date "${dueText}" isn't a date I can read. Try 2026-10-20 or 10/20/2026.`);
    const status = cell("status") ?? "";
    invoices.push({
      row,
      number: cell("number")?.slice(0, 40) ?? null,
      customer: cell("customer")?.slice(0, 80) ?? null,
      email: cell("email")?.slice(0, 200) ?? null,
      amount,
      due,
      paid: /\b(?:paid|settled|cleared|yes)\b/i.test(status) && !/\b(?:unpaid|not paid|no|partial|partially|partly)\b/i.test(status),
    });
  });
  return { invoices, problems, missingColumns: [] };
}

/** The events a check of the sheet sends, and what it left alone. */
export interface SheetEvents {
  /** `invoice-late` payloads, one per unpaid invoice past its due date. */
  readonly late: readonly SheetEvent[];
  /** `invoice-paid` payloads, one per paid invoice. */
  readonly paid: readonly SheetEvent[];
  /** Unpaid invoices not due yet. */
  readonly notDue: number;
  readonly problems: readonly string[];
}

/** One event built from a row, with the invoice key it's about. */
export interface SheetEvent {
  readonly key: string;
  readonly payload: Readonly<Record<string, string | number>>;
}

/** Turn the sheet's invoices into events as of `today` (`YYYY-MM-DD`): overdue unpaid rows remind, paid rows stop reminders. */
export function sheetEvents(invoices: readonly SheetInvoice[], today: string): SheetEvents {
  const late: SheetEvent[] = [];
  const paid: SheetEvent[] = [];
  const problems: string[] = [];
  let notDue = 0;
  for (const invoice of invoices) {
    const key = invoiceKey({ number: invoice.number, email: invoice.email, name: invoice.customer, amount: invoice.amount });
    if (key === null) {
      problems.push(`Row ${invoice.row} has no invoice number, customer or email, so I can't tell it apart.`);
      continue;
    }
    const who = { ...(invoice.customer ? { name: invoice.customer } : {}), ...(invoice.email ? { email: invoice.email } : {}), ...(invoice.number ? { number: invoice.number } : {}) };
    if (invoice.paid) {
      paid.push({ key, payload: { ...who, amount: invoice.amount } });
      continue;
    }
    if (invoice.due === null) {
      problems.push(`Row ${invoice.row} has no due date, so I can't tell if it's late.`);
      continue;
    }
    if (invoice.due >= today) {
      notDue += 1;
      continue;
    }
    late.push({ key, payload: { ...who, amount: invoice.amount, kind: "overdue", due: shortDate(invoice.due) } });
  }
  return { late, paid, notDue, problems };
}

/** Today's date as `YYYY-MM-DD` in `timeZone`, so "overdue" means past due where the business is. */
export function dateIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** What one check of the sheet did. */
export interface SheetSyncResult {
  readonly invoices: number;
  readonly drafted: number;
  /** Reminders a paid row stopped. */
  readonly stopped: number;
  /** Overdue invoices that already have a reminder, so the check drafted no new one. */
  readonly alreadyDrafted: number;
  readonly notDue: number;
  readonly problems: readonly string[];
  readonly missingColumns: readonly string[];
}

/** Say what a check of the sheet did, in the owner's terms, naming at most three problems. */
export function sheetSyncReply(result: SheetSyncResult): string {
  if (result.missingColumns.length > 0) {
    return `I opened your sheet, but its first row needs these columns: ${result.missingColumns.join(", ")}. Add them as headers and ask me to check the sheet again.`;
  }
  const lines = [`I checked your invoice sheet: ${result.invoices} invoice${result.invoices === 1 ? "" : "s"}.`];
  if (result.drafted > 0) lines.push(`I drafted ${result.drafted} reminder${result.drafted === 1 ? "" : "s"} for overdue invoices. ${result.drafted === 1 ? "It's" : "They're"} waiting in Approvals.`);
  if (result.stopped > 0) lines.push(`I stopped ${result.stopped} reminder${result.stopped === 1 ? "" : "s"} for invoices now marked paid.`);
  if (result.alreadyDrafted > 0) lines.push(`${result.alreadyDrafted} overdue invoice${result.alreadyDrafted === 1 ? " already has" : "s already have"} a reminder.`);
  if (result.notDue > 0) lines.push(`${result.notDue} ${result.notDue === 1 ? "isn't" : "aren't"} due yet.`);
  if (result.drafted === 0 && result.stopped === 0 && result.alreadyDrafted === 0) lines.push("Nothing needs a reminder right now.");
  const shown = result.problems.slice(0, 3);
  if (shown.length > 0) lines.push(shown.join(" ") + (result.problems.length > shown.length ? ` And ${result.problems.length - shown.length} more.` : ""));
  return lines.join(" ");
}

/** Where each known column sits in the header row. */
function columnPositions(header: readonly string[]): Partial<Record<Column, number>> {
  const at: Partial<Record<Column, number>> = {};
  header.forEach((raw, index) => {
    const name = raw.trim().toLowerCase().replace(/\s+/g, " ");
    for (const column of Object.keys(HEADERS) as Column[]) {
      if (at[column] === undefined && HEADERS[column].includes(name)) {
        at[column] = index;
        return;
      }
    }
  });
  return at;
}

/** Read "$1,240.50", "1240.5" or "450" as dollars, or `null`. */
function readAmount(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "").replace(/^usd/i, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Read "2026-10-20", "10/20/2026", "10/20/26" or "Oct 20, 2026" as `YYYY-MM-DD`, or `null`. */
function readDate(text: string): string | null {
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  const named = text.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  let year: number;
  let month: number;
  let day: number;
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us) [month, day, year] = [Number(us[1]), Number(us[2]), Number(us[3]?.length === 2 ? `20${us[3]}` : us[3])];
  else if (named) [month, day, year] = [MONTHS.indexOf((named[1] ?? "").slice(0, 3).toLowerCase()) + 1, Number(named[2]), Number(named[3])];
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // A date like Feb 30 rolls into March, so the parts must survive the round trip.
  if (month < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** "2026-10-20" as "Oct 20", the way a reminder says it. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  const name = MONTHS[(month ?? 1) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${day}`;
}

