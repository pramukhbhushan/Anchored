import { describe, expect, it } from "vitest";
import { asksToCheckSheet, dateIn, parseInvoiceRows, sheetEvents, sheetIdFromText, sheetSyncReply, type SheetSyncResult } from "@/lib/domain/invoice-sheet";

// =============================================================================
// Module Overview
// =============================================================================
// Reading an owner's invoice sheet in plain code: the link in a chat message,
// headers in any order and wording, amounts and dates as owners type them,
// rows it can't use, which rows are overdue or paid as of a day, and the reply
// that says what a check found.

const HEADER = ["Invoice #", "Customer", "Email", "Amount", "Due date", "Status", "Service"];
// The Brightpath Coaching test sheet, as Google returns it.
const BRIGHTPATH = [
  HEADER,
  ["1042", "Maya Chen", "maya.chen@example.com", "450", "2026-10-20", "Unpaid", "Career coaching package (3 sessions)"],
  ["1043", "Jordan Ellis", "jordan.ellis@example.com", "1200", "2026-10-28", "Unpaid", "Executive coaching retainer (October)"],
  ["1044", "Priya Patel", "priya.patel@example.com", "300", "2026-11-20", "Unpaid", "Interview prep (2 sessions)"],
  ["1045", "Sam Lee", "sam.lee@example.com", "240", "2026-10-15", "Paid", "Resume review and strategy call"],
  ["", "Dev Rao", "dev.rao@example.com", "175", "2026-10-30", "Unpaid", "Single coaching session"],
  ["1046", "Maya Chen", "maya.chen@example.com", "90", "2026-11-01", "Unpaid", "Follow-up session"],
  ["1047", "Alex Romero", "alex.romero@example.com", "600", "2026-10-25", "Unpaid", "Leadership workshop seat"],
];

describe("sheetIdFromText", () => {
  it("finds the ID in a pasted link", () => {
    expect(sheetIdFromText("connect my invoice sheet https://docs.google.com/spreadsheets/d/1jYg4Sn7znhd57XYKdPfj53reorhkliVlOoTEEQsIKiw/edit?usp=sharing")).toBe(
      "1jYg4Sn7znhd57XYKdPfj53reorhkliVlOoTEEQsIKiw",
    );
    expect(sheetIdFromText("no link here")).toBeNull();
    expect(sheetIdFromText("https://docs.google.com/document/d/1jYg4Sn7znhd57XYKdPfj53reorhkliVlOoTEEQsIKiw/edit")).toBeNull();
  });
});

describe("asksToCheckSheet", () => {
  it("hears a request to read the sheet again", () => {
    expect(asksToCheckSheet("check my invoice sheet")).toBe(true);
    expect(asksToCheckSheet("can you sync my invoices")).toBe(true);
    expect(asksToCheckSheet("refresh the spreadsheet")).toBe(true);
    expect(asksToCheckSheet("Maya paid 1042")).toBe(false);
  });
});

describe("parseInvoiceRows", () => {
  it("reads the Brightpath sheet", () => {
    const parsed = parseInvoiceRows(BRIGHTPATH);
    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.problems).toEqual([]);
    expect(parsed.invoices).toHaveLength(7);
    expect(parsed.invoices[0]).toEqual({ row: 2, number: "1042", customer: "Maya Chen", email: "maya.chen@example.com", amount: 450, due: "2026-10-20", paid: false });
    expect(parsed.invoices[3]?.paid).toBe(true);
    expect(parsed.invoices[4]?.number).toBeNull();
  });

  it("matches headers in any order and wording", () => {
    const parsed = parseInvoiceRows([
      ["STATUS", "client name", "Total", "Date due", "Invoice No"],
      ["unpaid", "Maya Chen", "$1,240.50", "10/20/2026", "2031"],
    ]);
    expect(parsed.invoices[0]).toMatchObject({ customer: "Maya Chen", amount: 1240.5, due: "2026-10-20", number: "2031", email: null, paid: false });
  });

  it("reads dates the way owners type them", () => {
    const rows = (due: string) => parseInvoiceRows([HEADER, ["1", "A", "", "10", due, "Unpaid"]]).invoices[0]?.due;
    expect(rows("2026-10-20")).toBe("2026-10-20");
    expect(rows("10/20/26")).toBe("2026-10-20");
    expect(rows("Oct 20, 2026")).toBe("2026-10-20");
    expect(rows("October 20 2026")).toBe("2026-10-20");
    expect(rows("2/30/2026")).toBeNull();
  });

  it("reads 'Not paid' as unpaid and 'Paid in full' as paid", () => {
    const status = (value: string) => parseInvoiceRows([HEADER, ["1", "A", "", "10", "2026-10-20", value]]).invoices[0]?.paid;
    expect(status("Paid in full")).toBe(true);
    expect(status("Not paid")).toBe(false);
    expect(status("Unpaid")).toBe(false);
    expect(status("")).toBe(false);
  });

  it("skips rows it can't use and says why, by row number", () => {
    const parsed = parseInvoiceRows([HEADER, ["1", "A", "", "abc", "2026-10-20", "Unpaid"], ["", "", "", "", "", ""], ["2", "B", "", "", "2026-10-20", "Unpaid"], ["3", "C", "", "10", "someday", "Unpaid"]]);
    expect(parsed.invoices.map((invoice) => invoice.number)).toEqual(["3"]);
    expect(parsed.problems).toEqual([
      `Row 2's amount "abc" isn't a number, so I skipped it.`,
      "Row 4 has no amount, so I skipped it.",
      `Row 5's due date "someday" isn't a date I can read. Try 2026-10-20 or 10/20/2026.`,
    ]);
  });

  it("names the columns a header lacks", () => {
    expect(parseInvoiceRows([["Name", "Notes"]]).missingColumns).toEqual(["Amount", "Status", "Due date"]);
    expect(parseInvoiceRows([["Amount", "Status", "Due date"]]).missingColumns).toEqual(["Invoice # or Customer"]);
    expect(parseInvoiceRows([]).missingColumns).toHaveLength(4);
  });
});

describe("sheetEvents", () => {
  it("reminds for overdue unpaid rows and stops reminders for paid ones, as of Nov 8", () => {
    const events = sheetEvents(parseInvoiceRows(BRIGHTPATH).invoices, "2026-11-08");
    expect(events.late.map((event) => event.key)).toEqual(["n:1042", "n:1043", "e:dev.rao@example.com:175.00", "n:1046", "n:1047"]);
    expect(events.late[0]?.payload).toEqual({ name: "Maya Chen", email: "maya.chen@example.com", number: "1042", amount: 450, kind: "overdue", due: "Oct 20" });
    expect(events.paid).toEqual([{ key: "n:1045", payload: { name: "Sam Lee", email: "sam.lee@example.com", number: "1045", amount: 240 } }]);
    expect(events.notDue).toBe(1);
    expect(events.problems).toEqual([]);
  });

  it("doesn't count an invoice due today as late", () => {
    const events = sheetEvents(parseInvoiceRows([HEADER, ["1", "A", "", "10", "2026-11-08", "Unpaid"]]).invoices, "2026-11-08");
    expect(events.late).toEqual([]);
    expect(events.notDue).toBe(1);
  });

  it("flags unpaid rows with no due date", () => {
    const events = sheetEvents(parseInvoiceRows([HEADER, ["1", "A", "", "10", "", "Unpaid"]]).invoices, "2026-11-08");
    expect(events.problems).toEqual(["Row 2 has no due date, so I can't tell if it's late."]);
  });
});

describe("dateIn", () => {
  it("uses the business's own day, not UTC's", () => {
    // 2 a.m. UTC on Nov 9 is still Nov 8 in Maryland.
    expect(dateIn("America/New_York", new Date("2026-11-09T02:00:00Z"))).toBe("2026-11-08");
  });
});

describe("sheetSyncReply", () => {
  const base: SheetSyncResult = { invoices: 7, drafted: 5, stopped: 0, alreadyDrafted: 0, notDue: 1, problems: [], missingColumns: [] };

  it("says what the check did", () => {
    expect(sheetSyncReply(base)).toBe("I checked your invoice sheet: 7 invoices. I drafted 5 reminders for overdue invoices. They're waiting in Approvals. 1 isn't due yet.");
    expect(sheetSyncReply({ ...base, drafted: 0, stopped: 1, alreadyDrafted: 4, notDue: 0 })).toBe(
      "I checked your invoice sheet: 7 invoices. I stopped 1 reminder for invoices now marked paid. 4 overdue invoices already have a reminder.",
    );
    expect(sheetSyncReply({ ...base, drafted: 0, notDue: 0 })).toBe("I checked your invoice sheet: 7 invoices. Nothing needs a reminder right now.");
  });

  it("names at most three problems", () => {
    const reply = sheetSyncReply({ ...base, problems: ["One.", "Two.", "Three.", "Four.", "Five."] });
    expect(reply).toContain("One. Two. Three. And 2 more.");
  });

  it("asks for missing columns instead", () => {
    expect(sheetSyncReply({ ...base, missingColumns: ["Amount", "Status"] })).toBe(
      "I opened your sheet, but its first row needs these columns: Amount, Status. Add them as headers and ask me to check the sheet again.",
    );
  });
});
