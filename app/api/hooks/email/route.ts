import { readInboundEmail } from "@/lib/connectors/email";
import { handleError, json } from "@/lib/server/http";
import { connectionFor, receiveEmail } from "@/lib/server/hooks";
import { sameSecret } from "@/lib/server/secrets";

// =============================================================================
// Module Overview
// =============================================================================
// Postmark's inbound webhook. Every forwarding address shares one Postmark
// inbound server, which posts here with `?key=` set to `INBOUND_EMAIL_SECRET`.
// The hook id after the "+" in the address names the business, and the email
// goes to Inbox Triage. Attachments are ignored.

/** Receive one forwarded email. */
export async function POST(request: Request) {
  try {
    const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
    const key = new URL(request.url).searchParams.get("key") ?? "";
    if (!secret || !sameSecret(key, secret)) return new Response("Not found", { status: 404 });
    const email = readInboundEmail(await request.json());
    // Postmark retries on an error, so an email for no business is acknowledged and dropped.
    if (email === null) return json({ received: true, drafted: false });
    const target = await connectionFor(email.mailbox.toLowerCase(), "email-in");
    const drafted = target === null ? false : await receiveEmail(target, email);
    return json({ received: true, drafted });
  } catch (error) {
    return handleError(error, "POST /api/hooks/email");
  }
}
