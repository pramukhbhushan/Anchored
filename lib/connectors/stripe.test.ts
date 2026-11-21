import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readUnpaidInvoice, verifyStripeSignature } from "./stripe";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the Stripe adapter: a webhook signed with the endpoint's secret
// within five minutes passes, and a stale, wrongly signed or unsigned one
// fails. Only overdue and failed invoices in US dollars become an unpaid
// invoice, with the amount in dollars and Stripe's event id.

const SECRET = "whsec_test";
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "invoice.overdue" });
const SIGNED_AT = 1_800_000_000;

/** The `v1` signature Stripe would send for `payload` at `timestamp`. */
function sign(payload: string, timestamp: number, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

describe("verifyStripeSignature", () => {
  const header = `t=${SIGNED_AT},v1=${sign(PAYLOAD, SIGNED_AT)}`;

  it("accepts a signed event within five minutes", () => {
    expect(verifyStripeSignature(SECRET, PAYLOAD, header, SIGNED_AT)).toBe(true);
    expect(verifyStripeSignature(SECRET, PAYLOAD, header, SIGNED_AT + 300)).toBe(true);
  });

  it("refuses a stale event, so a captured one can't be replayed", () => {
    expect(verifyStripeSignature(SECRET, PAYLOAD, header, SIGNED_AT + 301)).toBe(false);
  });

  it("refuses the wrong secret, a changed payload and a missing header", () => {
    expect(verifyStripeSignature("whsec_other", PAYLOAD, header, SIGNED_AT)).toBe(false);
    expect(verifyStripeSignature(SECRET, PAYLOAD.replace("evt_1", "evt_2"), header, SIGNED_AT)).toBe(false);
    expect(verifyStripeSignature(SECRET, PAYLOAD, null, SIGNED_AT)).toBe(false);
    expect(verifyStripeSignature(SECRET, PAYLOAD, `v1=${sign(PAYLOAD, SIGNED_AT)}`, SIGNED_AT)).toBe(false);
  });

  it("accepts a header with several v1 signatures when one matches", () => {
    const rolled = `t=${SIGNED_AT},v1=${sign(PAYLOAD, SIGNED_AT, "whsec_old")},v1=${sign(PAYLOAD, SIGNED_AT)},v0=ignored`;
    expect(verifyStripeSignature(SECRET, PAYLOAD, rolled, SIGNED_AT)).toBe(true);
  });
});

describe("readUnpaidInvoice", () => {
  /** A Stripe invoice event of `type` in `currency`. */
  function event(type: string, currency = "usd") {
    return {
      type,
      data: { object: { customer_name: "Dana Lee", customer_email: "dana@example.com", amount_due: 12550, currency, number: "INV-0042" } },
    };
  }

  it("reads an overdue invoice with the amount in dollars", () => {
    expect(readUnpaidInvoice(event("invoice.overdue"))).toEqual({
      eventId: null,
      kind: "overdue",
      customerName: "Dana Lee",
      customerEmail: "dana@example.com",
      amountDue: 125.5,
      number: "INV-0042",
    });
  });

  it("reads a failed payment", () => {
    expect(readUnpaidInvoice(event("invoice.payment_failed", "USD"))).toMatchObject({ kind: "failed", amountDue: 125.5 });
  });

  it("keeps Stripe's event id, and drops one that isn't Stripe's shape", () => {
    expect(readUnpaidInvoice({ id: "evt_1QxYz", ...event("invoice.overdue") })?.eventId).toBe("evt_1QxYz");
    expect(readUnpaidInvoice({ id: "evt_1:event:x", ...event("invoice.overdue") })?.eventId).toBeNull();
  });

  it("returns null for other events, other currencies and malformed events", () => {
    expect(readUnpaidInvoice(event("invoice.paid"))).toBeNull();
    expect(readUnpaidInvoice(event("invoice.overdue", "eur"))).toBeNull();
    expect(readUnpaidInvoice({ type: "invoice.overdue", data: {} })).toBeNull();
  });
});
