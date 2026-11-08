import { describe, expect, it } from "vitest";
import { licenseSchema, licensesSchema, renewalNotice, type License } from "@/lib/domain/renewals";

// =============================================================================
// Module Overview
// =============================================================================
// Checks that evidenced renewal facts create only owner notices in their
// current warning window. Civil-date boundaries include both US clock changes
// and different business time zones. Bad facts never create a reminder.

const license: License = {
  id: "food-permit",
  name: "Food permit",
  expiresOn: "2027-03-15",
  evidence: "Printed expiry date on the permit.",
};

describe("license facts", () => {
  it.each(["2027-02-29", "2027-02-30", "2027-13-01", "2027-00-01", "2027-03-00", "2027-3-15", "March 15", "", "2027-03-15T00:00:00Z"])("rejects the invalid expiry date %s", (expiresOn) => {
    expect(licenseSchema.safeParse({ ...license, expiresOn }).success).toBe(false);
  });

  it("accepts a real leap day and requires source evidence", () => {
    expect(licenseSchema.safeParse({ ...license, expiresOn: "2028-02-29" }).success).toBe(true);
    expect(licenseSchema.safeParse({ ...license, evidence: "  " }).success).toBe(false);
    expect(licenseSchema.safeParse({ ...license, expiresOn: undefined }).success).toBe(false);
  });

  it("requires separate stable ids for separate licenses", () => {
    expect(licensesSchema.safeParse([license, { ...license, name: "Another permit" }]).success).toBe(false);
    expect(licensesSchema.safeParse([license, { ...license, id: "another" }]).success).toBe(true);
  });
});

describe("renewal windows", () => {
  it.each([
    ["2027-02-12T12:00:00Z", null, null],
    ["2027-02-13T12:00:00Z", "30-days", 30],
    ["2027-03-07T12:00:00Z", "30-days", 8],
    ["2027-03-08T12:00:00Z", "7-days", 7],
    ["2027-03-14T12:00:00Z", "7-days", 1],
    ["2027-03-15T12:00:00Z", "expiry-day", 0],
    ["2027-03-16T12:00:00Z", "overdue", -1],
  ])("uses only the reached window at %s", (at, window, days) => {
    const notice = renewalNotice(license, new Date(at));
    expect(notice?.window ?? null).toBe(window);
    expect(notice?.daysUntilExpiry ?? null).toBe(days);
  });

  it("dedupes within a window and gives a changed expiry a new identity", () => {
    const first = renewalNotice(license, new Date("2027-03-09T12:00:00Z"));
    expect(renewalNotice(license, new Date("2027-03-10T12:00:00Z"))?.key).toBe(first?.key);
    expect(renewalNotice({ ...license, expiresOn: "2027-03-16" }, new Date("2027-03-10T12:00:00Z"))?.key).not.toBe(first?.key);
    expect(first?.key).toBe("renewal:food-permit:2027-03-15:7-days");
  });

  it("stops reminding once the owner marks the license handled", () => {
    expect(renewalNotice({ ...license, completed: true }, new Date("2027-03-16T12:00:00Z"))).toBeNull();
  });

  it("keeps the recorded date and source without claiming to renew anything", () => {
    const notice = renewalNotice(license, new Date("2027-03-15T12:00:00Z"));
    expect(notice?.title).toBe("Food permit expires today");
    expect(notice?.body).toContain("2027-03-15");
    expect(notice?.body).toContain(license.evidence);
    expect(notice?.body).toContain("handle its renewal yourself");
  });
});

describe("civil dates and clock changes", () => {
  it("uses the business date around midnight, not the UTC date", () => {
    const now = new Date("2027-03-15T01:00:00Z");
    expect(renewalNotice(license, now, "America/New_York")?.daysUntilExpiry).toBe(1);
    expect(renewalNotice(license, now, "Asia/Tokyo")?.daysUntilExpiry).toBe(0);
  });

  it("keeps one civil day across the spring clock change's 23-hour day", () => {
    const spring = { ...license, expiresOn: "2027-03-15" };
    expect(renewalNotice(spring, new Date("2027-03-14T05:00:00Z"))?.daysUntilExpiry).toBe(1);
    expect(renewalNotice(spring, new Date("2027-03-15T03:59:59Z"))?.daysUntilExpiry).toBe(1);
    expect(renewalNotice(spring, new Date("2027-03-15T04:00:00Z"))?.daysUntilExpiry).toBe(0);
  });

  it("keeps one civil day across the autumn clock change's 25-hour day", () => {
    const autumn = { ...license, expiresOn: "2027-11-08" };
    expect(renewalNotice(autumn, new Date("2027-11-07T04:00:00Z"))?.daysUntilExpiry).toBe(1);
    expect(renewalNotice(autumn, new Date("2027-11-08T04:59:59Z"))?.daysUntilExpiry).toBe(1);
    expect(renewalNotice(autumn, new Date("2027-11-08T05:00:00Z"))?.daysUntilExpiry).toBe(0);
  });

  it("does not guess after invalid facts, a bad clock or an unknown time zone", () => {
    expect(renewalNotice({ ...license, expiresOn: "2027-02-30" }, new Date())).toBeNull();
    expect(renewalNotice(license, new Date("bad date"))).toBeNull();
    expect(renewalNotice(license, new Date("2027-03-15T12:00:00Z"), "unknown/place")).toBeNull();
  });
});
