import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// =============================================================================
// Module Overview
// =============================================================================
// Stripe tells Anchored when an invoice goes unpaid. `verifyStripeSignature`
// checks the `Stripe-Signature` header against the endpoint's signing secret,
// and `readUnpaidInvoice` reads an `invoice.overdue` or `invoice.payment_failed`
// event into what Payment Nudger needs, with the event id that keeps a replayed
// event from drafting a second card. Anchored never charges a card.

// Stripe's default: an event signed more than five minutes ago is refused, so a captured one can't be replayed.
const TOLERANCE_SECONDS = 300;

/** Whether `header` signs `payload` with `secret` within five minutes of `nowSeconds`. */
export function verifyStripeSignature(secret: string, payload: string, header: string | null, nowSeconds: number): boolean {
  if (header === null) return false;
  const parts = header.split(",").map((part) => part.split("=", 2) as [string, string | undefined]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex"));
  return parts.some(([key, value]) => {
    if (key !== "v1" || value === undefined) return false;
    const given = Buffer.from(value);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const invoiceEvent = z.object({
  id: z.string().optional(),
  type: z.string(),
  data: z.object({
    object: z.object({
      customer_name: z.string().nullable().optional(),
      customer_email: z.string().nullable().optional(),
      amount_due: z.number().int().nonnegative(),
      currency: z.string(),
      number: z.string().nullable().optional(),
    }),
  }),
});

/** An unpaid invoice, as Payment Nudger reads it. */
export interface UnpaidInvoice {
  /** Stripe's event id, such as `evt_1A2b`, or `null` when the event has none of the expected shape. */
  readonly eventId: string | null;
  readonly kind: "overdue" | "failed";
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  /** In dollars. */
  readonly amountDue: number;
  readonly number: string | null;
}

/** Read an unpaid-invoice event, or `null` for any other event or a currency other than US dollars. */
export function readUnpaidInvoice(event: unknown): UnpaidInvoice | null {
  const parsed = invoiceEvent.safeParse(event);
  if (!parsed.success) return null;
  const { id, type, data } = parsed.data;
  const kind = type === "invoice.overdue" ? "overdue" : type === "invoice.payment_failed" ? "failed" : null;
  if (kind === null || data.object.currency.toLowerCase() !== "usd") return null;
  return {
    // The id becomes part of a card key, so only Stripe's own shape is kept.
    eventId: id !== undefined && /^evt_\w{1,120}$/.test(id) ? id : null,
    kind,
    customerName: data.object.customer_name?.trim().slice(0, 80) || null,
    customerEmail: data.object.customer_email?.trim().slice(0, 200) || null,
    amountDue: data.object.amount_due / 100,
    number: data.object.number?.trim().slice(0, 40) || null,
  };
}
