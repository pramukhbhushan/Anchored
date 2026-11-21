import { readUnpaidInvoice, verifyStripeSignature } from "@/lib/connectors/stripe";
import { handleError, json } from "@/lib/server/http";
import { connectionFor, receiveUnpaidInvoice } from "@/lib/server/hooks";
import { decryptSecret } from "@/lib/server/secrets";

// =============================================================================
// Module Overview
// =============================================================================
// Stripe's webhook for one business. Each event must carry a `Stripe-Signature`
// made with the endpoint's signing secret within the last five minutes. An
// `invoice.overdue` or `invoice.payment_failed` event becomes a Payment Nudger
// draft, once per Stripe event id, so a retried or replayed event drafts no
// second card; every other event is acknowledged and ignored.

/** Receive one Stripe event. */
export async function POST(request: Request, { params }: { params: Promise<{ hookId: string }> }) {
  try {
    const target = await connectionFor((await params).hookId, "stripe");
    if (target === null || target.connection.secret === null) return new Response("Not found", { status: 404 });
    // The signature covers the exact bytes Stripe sent, so the body is read as text before any parsing.
    const payload = await request.text();
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!verifyStripeSignature(decryptSecret(target.connection.secret), payload, request.headers.get("stripe-signature"), nowSeconds)) {
      return new Response("Signature check failed", { status: 400 });
    }
    const invoice = readUnpaidInvoice(JSON.parse(payload) as unknown);
    const drafted = invoice === null ? false : await receiveUnpaidInvoice(target, invoice);
    return json({ received: true, drafted });
  } catch (error) {
    return handleError(error, "POST /api/hooks/stripe/[hookId]");
  }
}
