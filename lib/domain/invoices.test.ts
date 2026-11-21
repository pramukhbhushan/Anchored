import { describe, expect, it } from "vitest";
import {
  MAX_REMINDERS,
  canRemind,
  checkReminderDraft,
  followUpQuestion,
  invoiceKey,
  matchPaidInvoice,
  readInvoiceMessage,
  reminderRecords,
  remindersFor,
  talksAboutInvoice,
  type InvoiceCard,
  type InvoiceFacts,
  type ReminderRecord,
} from "@/lib/domain/invoices";

// =============================================================================
// Module Overview
// =============================================================================
// Bookkeeping's plain-code rules: reading an owner's words about money owed or
// paid, asking for what's missing, counting reminders per invoice, refusing a
// reminder with a made-up number or a threat, and comparing supplier prices.

describe("readInvoiceMessage: money owed", () => {
  it("reads the name, amount, number and due date", () => {
    expect(readInvoiceMessage("Sam Lee owes $240 on invoice 1042, due Oct 20")).toEqual({
      kind: "owed",
      facts: { name: "Sam Lee", amount: 240, number: "1042", due: "Oct 20" },
      missing: [],
    });
  });

  it("reads amounts with commas and cents, and the # and INV- forms", () => {
    const a = readInvoiceMessage("Maya Chen owes $1,240.50 for her coaching package, #2031");
    expect(a.kind === "owed" && a.facts).toMatchObject({ name: "Maya Chen", amount: 1240.5, number: "2031" });
    const b = readInvoiceMessage("Priya Patel hasn't paid INV-3007, it's 450 dollars");
    expect(b.kind === "owed" && b.facts).toMatchObject({ name: "Priya Patel", amount: 450, number: "INV-3007" });
  });

  it("reads due dates written as numbers", () => {
    const a = readInvoiceMessage("Dev Rao owes $300, due 10/15");
    expect(a.kind === "owed" && a.facts.due).toBe("10/15");
    const b = readInvoiceMessage("Dev Rao owes $300, due 2026-10-15");
    expect(b.kind === "owed" && b.facts.due).toBe("2026-10-15");
  });

  it("drops a leading greeting and an article from the name", () => {
    const a = readInvoiceMessage("Hey, Sam Lee still owes $90");
    expect(a.kind === "owed" && a.facts.name).toBe("Sam Lee");
    const b = readInvoiceMessage("The Lewis family hasn't paid $600 yet");
    expect(b.kind === "owed" && b.facts.name).toBe("Lewis family");
  });

  it("never reads an invoice number from 'invoice for $240'", () => {
    const message = readInvoiceMessage("Sam owes an invoice for $240");
    expect(message.kind === "owed" && message.facts).toMatchObject({ amount: 240, number: null });
  });

  it("lists what's missing instead of guessing", () => {
    expect(readInvoiceMessage("Jordan still owes me")).toMatchObject({ kind: "owed", facts: { name: "Jordan", amount: null }, missing: ["amount"] });
    expect(readInvoiceMessage("someone owes me $200")).toMatchObject({ kind: "owed", missing: ["name"] });
    expect(readInvoiceMessage("an invoice is overdue")).toMatchObject({ kind: "owed", missing: ["name", "amount"] });
  });

  it("asks rather than picks when the message names two different amounts", () => {
    const message = readInvoiceMessage("Sam Lee paid $100 but still owes $140");
    expect(message).toMatchObject({ kind: "owed", facts: { amount: null }, missing: ["amount"] });
  });

  it("counts 'hasn't paid' as owed, not paid", () => {
    expect(readInvoiceMessage("Sam hasn't paid $50").kind).toBe("owed");
    expect(readInvoiceMessage("Sam didn't pay invoice 1042, $50").kind).toBe("owed");
  });
});

describe("readInvoiceMessage: payments", () => {
  it("reads a payment by name and bare number", () => {
    expect(readInvoiceMessage("Sam paid 1042")).toEqual({ kind: "paid", facts: { name: "Sam", amount: null, number: "1042", due: null }, missing: [] });
  });

  it("reads 'invoice 1042 is settled' and '1042 was cleared'", () => {
    const a = readInvoiceMessage("invoice 1042 is settled");
    expect(a.kind === "paid" && a.facts.number).toBe("1042");
    const b = readInvoiceMessage("1042 was cleared");
    expect(b.kind === "paid" && b.facts.number).toBe("1042");
  });

  it("reads a payment by name alone", () => {
    expect(readInvoiceMessage("Maya Chen paid in full")).toMatchObject({ kind: "paid", facts: { name: "Maya Chen", number: null }, missing: [] });
  });

  it("doesn't take a dollar amount for the invoice number", () => {
    const message = readInvoiceMessage("Sam paid $240");
    expect(message.kind === "paid" && message.facts).toMatchObject({ amount: 240, number: null });
  });

  it("asks which invoice when nothing identifies it", () => {
    expect(readInvoiceMessage("got the payment today")).toMatchObject({ kind: "paid", missing: ["invoice"] });
  });
});

describe("readInvoiceMessage: other messages", () => {
  it("ignores messages that aren't about money owed or paid", () => {
    expect(readInvoiceMessage("write a post about our new group program")).toEqual({ kind: "none" });
    expect(readInvoiceMessage("text Dana we're running late")).toEqual({ kind: "none" });
    expect(readInvoiceMessage("   ")).toEqual({ kind: "none" });
  });
});

describe("followUpQuestion", () => {
  it("asks only for what's missing", () => {
    const message = readInvoiceMessage("Jordan still owes me");
    expect(message.kind !== "none" && followUpQuestion(message)).toBe("How much does Jordan owe? I'll only use the amount you give me.");
  });

  it("asks who owes when only the amount is known", () => {
    const message = readInvoiceMessage("someone owes me $200");
    expect(message.kind !== "none" && followUpQuestion(message)).toBe("Who owes the $200?");
  });

  it("asks which invoice for a payment with nothing to match", () => {
    const message = readInvoiceMessage("got the payment today");
    expect(message.kind !== "none" && followUpQuestion(message)).toMatch(/Which invoice was paid/);
  });

  it("asks nothing when the message is complete", () => {
    const message = readInvoiceMessage("Sam Lee owes $240 on invoice 1042");
    expect(message.kind !== "none" && followUpQuestion(message)).toBeNull();
  });
});

describe("invoiceKey", () => {
  it("treats 1042, #1042 and INV-1042 as one invoice", () => {
    expect(invoiceKey({ number: "1042" })).toBe("n:1042");
    expect(invoiceKey({ number: "#1042" })).toBe("n:1042");
    expect(invoiceKey({ number: "INV-1042" })).toBe("n:1042");
    expect(invoiceKey({ number: "inv1042" })).toBe("n:1042");
  });

  it("falls back to email or name plus amount", () => {
    expect(invoiceKey({ email: "Sam@Example.com", amount: 240 })).toBe("e:sam@example.com:240.00");
    expect(invoiceKey({ name: "Sam  Lee", amount: 240 })).toBe("p:sam lee:240.00");
  });

  it("keeps two invoices for one customer apart by amount", () => {
    expect(invoiceKey({ name: "Sam Lee", amount: 240 })).not.toBe(invoiceKey({ name: "Sam Lee", amount: 90 }));
  });

  it("returns null when nothing identifies the invoice", () => {
    expect(invoiceKey({ name: "Sam Lee" })).toBeNull();
    expect(invoiceKey({})).toBeNull();
  });
});

describe("canRemind", () => {
  const key = "n:1042";
  const records = (...statuses: ReminderRecord["status"][]): ReminderRecord[] => statuses.map((status) => ({ invoiceKey: key, status }));

  it("allows the first and second reminder and stops the third", () => {
    expect(MAX_REMINDERS).toBe(2);
    expect(canRemind([], key)).toBe(true);
    expect(canRemind(records("approved"), key)).toBe(true);
    expect(canRemind(records("approved", "pending"), key)).toBe(false);
    expect(canRemind(records("approved", "approved", "approved"), key)).toBe(false);
  });

  it("doesn't count skipped or replaced reminders", () => {
    expect(remindersFor(records("skipped", "superseded", "approved"), key)).toBe(1);
    expect(canRemind(records("skipped", "skipped", "approved"), key)).toBe(true);
  });

  it("counts only the same invoice", () => {
    expect(canRemind([{ invoiceKey: "n:9999", status: "approved" }, { invoiceKey: "n:9999", status: "approved" }], key)).toBe(true);
  });

  it("refuses an invoice nothing identifies", () => {
    expect(canRemind([], null)).toBe(false);
  });
});

describe("checkReminderDraft", () => {
  const invoice: InvoiceFacts = { name: "Sam Lee", amount: 240, number: "1042", due: "Oct 20" };

  it("passes a reminder that uses the invoice's own facts", () => {
    expect(checkReminderDraft("Hi Sam, a quick reminder that invoice 1042 for $240 was due Oct 20. Thanks!", invoice)).toEqual({ ok: true });
    expect(checkReminderDraft("Hi Sam, invoice 1042 for $240.00 is open.", invoice)).toEqual({ ok: true });
  });

  it("refuses a changed amount", () => {
    expect(checkReminderDraft("Hi Sam, invoice 1042 for $260 is past due.", invoice)).toEqual({ ok: false, reason: "The draft says $260, but the invoice is for $240." });
  });

  it("refuses a late fee, even with no new number", () => {
    const check = checkReminderDraft("Hi Sam, invoice 1042 for $240 is past due. A late fee will apply.", invoice);
    expect(check.ok).toBe(false);
    expect(!check.ok && check.reason).toMatch(/late fee/);
  });

  it("refuses a threat", () => {
    expect(checkReminderDraft("Pay $240 for invoice 1042 or we'll send this to collections.", invoice).ok).toBe(false);
    expect(checkReminderDraft("Final notice: invoice 1042, $240.", invoice).ok).toBe(false);
  });

  it("refuses a number that isn't on the invoice", () => {
    expect(checkReminderDraft("Hi Sam, invoice 1042 for $240. Pay within 7 days.", invoice)).toEqual({ ok: false, reason: "The draft has the number 7, which isn't on the invoice." });
  });

  it("accepts numbers the caller vouches for, such as the business name", () => {
    expect(checkReminderDraft("Hi Sam, from Studio 54 Coaching: invoice 1042 for $240.", invoice, ["Studio 54 Coaching"])).toEqual({ ok: true });
  });

  it("reads amounts with commas and cents", () => {
    const big: InvoiceFacts = { name: "Maya", amount: 1240.5, number: "2031", due: null };
    expect(checkReminderDraft("Invoice 2031 for $1,240.50 is open.", big)).toEqual({ ok: true });
    expect(checkReminderDraft("Invoice 2031 for $1,250.50 is open.", big).ok).toBe(false);
  });

  it("refuses any amount when the invoice gave none", () => {
    expect(checkReminderDraft("Your balance is $50.", { name: "Sam", amount: null, number: null, due: null }).ok).toBe(false);
  });
});

describe("matchPaidInvoice", () => {
  const reminder = (key: string, status: InvoiceCard["status"], extra: Partial<InvoiceCard["invoice"]> = {}): InvoiceCard => ({
    skill: "nudger",
    status,
    invoice: { key, amount: 450, customer: "maya chen", ...extra },
  });
  const cards = [reminder("n:1042", "pending", { number: "1042" }), reminder("n:1046", "approved", { number: "1046", amount: 90 }), reminder("n:2000", "pending", { customer: "sam lee" })];

  it("matches by number, or by email or name with the amount", () => {
    expect(matchPaidInvoice(cards, { number: "INV-1042" })).toEqual({ kind: "match", key: "n:1042" });
    expect(matchPaidInvoice(cards, { name: "Dev Rao", amount: 175 })).toEqual({ kind: "match", key: "p:dev rao:175.00" });
  });

  it("matches a name alone to that customer's one open invoice", () => {
    expect(matchPaidInvoice(cards, { name: "Sam Lee" })).toEqual({ kind: "match", key: "n:2000" });
  });

  it("asks which one when the customer has two open invoices", () => {
    expect(matchPaidInvoice(cards, { name: "maya  Chen" })).toEqual({ kind: "ambiguous", options: ["invoice 1042", "invoice 1046"] });
  });

  it("finds a number-keyed reminder from a message that names the customer and amount", () => {
    const open = [reminder("n:1042", "pending", { number: "1042" })];
    expect(matchPaidInvoice(open, { name: "Maya Chen", amount: 450 })).toEqual({ kind: "match", key: "n:1042" });
  });

  it("keeps a direct key that an open reminder carries", () => {
    const byEmail = [reminder("e:maya.chen@example.com:450.00", "pending"), reminder("n:1046", "pending", { number: "1046", amount: 90 })];
    expect(matchPaidInvoice(byEmail, { email: "maya.chen@example.com", name: "Maya Chen", amount: 450 })).toEqual({ kind: "match", key: "e:maya.chen@example.com:450.00" });
  });

  it("still asks which one when a name and amount match no key and the customer has two open invoices", () => {
    expect(matchPaidInvoice(cards, { name: "Maya Chen", amount: 300 })).toEqual({ kind: "ambiguous", options: ["invoice 1042", "invoice 1046"] });
  });

  it("ignores closed reminders and finds nothing for an unknown customer", () => {
    expect(matchPaidInvoice([reminder("n:1042", "superseded")], { name: "Maya Chen" })).toEqual({ kind: "none" });
    expect(matchPaidInvoice(cards, { name: "Nobody" })).toEqual({ kind: "none" });
    expect(matchPaidInvoice(cards, {})).toEqual({ kind: "none" });
  });

  it("counts only reminder cards for the cap", () => {
    expect(reminderRecords([...cards, { skill: "posts", status: "pending" }])).toEqual([
      { invoiceKey: "n:1042", status: "pending" },
      { invoiceKey: "n:1046", status: "approved" },
      { invoiceKey: "n:2000", status: "pending" },
    ]);
  });
});

describe("talksAboutInvoice", () => {
  const about = (text: string) => talksAboutInvoice(readInvoiceMessage(text), text);

  it("is true for a customer's debt or payment", () => {
    expect(about("Sam Lee owes $240")).toBe(true);
    expect(about("someone owes me $200")).toBe(true);
    expect(about("invoice 1042 is settled")).toBe(true);
    expect(about("Maya paid")).toBe(true);
    expect(about("the bill is overdue")).toBe(true);
  });

  it("is false for money the business paid, or debts with nothing to go on", () => {
    expect(about("We paid $300 for new ads")).toBe(false);
    expect(about("rent is overdue")).toBe(false);
    expect(about("got paid today")).toBe(false);
    expect(about("write a post about our group program")).toBe(false);
  });
});
