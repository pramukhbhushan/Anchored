import { describe, expect, it } from "vitest";
import { applyOptOut, deliveryFor, isEmailAddress, normalizePhone, optOutKeyword, type Contact } from "@/lib/domain/contacts";

// =============================================================================
// Module Overview
// =============================================================================
// The rules for contacting a customer: phone numbers read one way, STOP and
// START replies, and when Anchored may send an approved text or email itself.

const DANA: Contact = {
  id: "c1",
  businessId: "hvac",
  name: "Dana",
  phone: "+13015550192",
  email: null,
  consent: { source: "texted-first", at: "2026-11-07T15:00:00Z" },
  optedOutAt: null,
};
const ON = { texting: true, email: true };

describe("normalizePhone", () => {
  it.each([
    ["(301) 555-0192", "+13015550192"],
    ["301.555.0192", "+13015550192"],
    ["1 301 555 0192", "+13015550192"],
    ["+1 301 555 0192", "+13015550192"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("reads %j as %j", (raw, phone) => {
    expect(normalizePhone(raw)).toBe(phone);
  });

  it.each(["555-0192", "Dana", "301 555 0192 ext 4", ""])("refuses %j", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe("optOutKeyword", () => {
  it.each(["STOP", "stop.", " Unsubscribe ", "Stop all", "QUIT", "revoke"])("reads %j as an opt-out", (text) => {
    expect(optOutKeyword(text)).toBe("stop");
  });

  it.each(["START", "unstop"])("reads %j as opting back in", (text) => {
    expect(optOutKeyword(text)).toBe("start");
  });

  it.each(["Please stop by at 3", "Can you come tomorrow?", "yes"])("reads %j as a message", (text) => {
    expect(optOutKeyword(text)).toBeNull();
  });

  it("clears an opt-out on START", () => {
    const stopped = applyOptOut(DANA, "stop", "2026-11-08T10:00:00Z");
    expect(stopped.optedOutAt).toBe("2026-11-08T10:00:00Z");
    expect(applyOptOut(stopped, "start", "2026-11-09T10:00:00Z").optedOutAt).toBeNull();
  });
});

describe("deliveryFor", () => {
  it("sends a text to a number with a consent record", () => {
    expect(deliveryFor({ channel: "sms", to: "(301) 555-0192" }, ON, [DANA])).toEqual({ by: "anchored", to: "+13015550192" });
  });

  it("leaves the text to the owner without a texting number, a phone number, consent, or after STOP", () => {
    expect(deliveryFor({ channel: "sms", to: "+13015550192" }, { texting: false, email: true }, [DANA])).toEqual({ by: "owner", reason: null });
    expect(deliveryFor({ channel: "sms", to: "Dana" }, ON, [DANA])).toMatchObject({ by: "owner", reason: expect.stringContaining("no phone number") });
    expect(deliveryFor({ channel: "sms", to: "+13015550100" }, ON, [DANA])).toMatchObject({ by: "owner", reason: expect.stringContaining("No texting OK") });
    expect(deliveryFor({ channel: "sms", to: "+13015550192" }, ON, [applyOptOut(DANA, "stop", "2026-11-08T10:00:00Z")])).toMatchObject({
      by: "owner",
      reason: expect.stringContaining("texted STOP"),
    });
  });

  it("sends an email to a real address once email is set up", () => {
    expect(deliveryFor({ channel: "email", to: "sam@example.com" }, ON, [])).toEqual({ by: "anchored", to: "sam@example.com" });
    expect(deliveryFor({ channel: "email", to: "Sam Patel" }, ON, [])).toMatchObject({ by: "owner" });
    expect(deliveryFor({ channel: "email", to: "sam@example.com" }, { texting: true, email: false }, [])).toEqual({ by: "owner", reason: null });
  });

  it("never sends a list card", () => {
    expect(deliveryFor({ channel: "list", to: "customer" }, ON, [DANA])).toEqual({ by: "owner", reason: null });
  });

  it("knows an email address", () => {
    expect(isEmailAddress("sam@example.com")).toBe(true);
    expect(isEmailAddress("Sam <sam@example.com>")).toBe(false);
  });
});
