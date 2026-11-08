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

  it("won't email a customer who opted out, matching the address in any case", () => {
    const alex: Contact = { ...DANA, id: "c-alex", name: "Alex Romero", phone: null, email: "alex.romero@example.com", optedOutAt: "2026-11-01T10:00:00Z" };
    expect(deliveryFor({ channel: "email", to: "Alex.Romero@example.com " }, ON, [alex])).toEqual({ by: "owner", reason: "This customer asked not to get messages. Anchored won't email them." });
    expect(deliveryFor({ channel: "email", to: "alex.romero@example.com" }, ON, [{ ...alex, optedOutAt: null }])).toEqual({ by: "anchored", to: "alex.romero@example.com" });
  });

  it("never sends a list card", () => {
    expect(deliveryFor({ channel: "list", to: "customer" }, ON, [DANA])).toEqual({ by: "owner", reason: null });
  });

  it("knows an email address", () => {
    expect(isEmailAddress("sam@example.com")).toBe(true);
    expect(isEmailAddress("Sam <sam@example.com>")).toBe(false);
  });
});

describe("deliveryFor on Telegram", () => {
  const TG: Contact = { ...DANA, id: "c2", phone: null, consent: { source: "messaged-first", at: "2026-11-07T15:00:00Z" }, telegramChatId: "5551234567" };
  const BOT = { texting: false, email: false, telegram: true };
  const message = { channel: "telegram", to: "Dana", contactId: "c2" };

  it("sends to the contact's chat, found by contact id, never by the name the owner reads", () => {
    expect(deliveryFor(message, BOT, [TG])).toEqual({ by: "anchored", to: "5551234567" });
    expect(deliveryFor({ ...message, contactId: "someone-else" }, BOT, [TG]).by).toBe("owner");
  });

  it("refuses with a reason when the bot isn't set up, the customer sent /stop, or there's no OK on file", () => {
    expect(deliveryFor(message, { ...BOT, telegram: false }, [TG])).toMatchObject({ by: "owner", reason: expect.stringContaining("Telegram isn't set up") });
    expect(deliveryFor(message, BOT, [{ ...TG, optedOutAt: "2026-11-08T10:00:00Z" }])).toMatchObject({ by: "owner", reason: expect.stringContaining("/stop") });
    expect(deliveryFor(message, BOT, [{ ...TG, consent: null }]).by).toBe("owner");
  });

  it("still delivers the bot's confirmation of a /stop", () => {
    expect(deliveryFor({ ...message, rule: "protocol" }, BOT, [{ ...TG, optedOutAt: "2026-11-08T10:00:00Z" }])).toEqual({ by: "anchored", to: "5551234567" });
  });
});
