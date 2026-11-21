import "server-only";
import { ConnectorError, PROVIDER_TIMEOUT_MS, type FetchLike } from "./errors";

// =============================================================================
// Module Overview
// =============================================================================
// Email out. `sendEmail` sends one approved email through the owner's own
// Resend account, from their verified address, under the business's name, with
// the owner as reply-to so answers reach their inbox.

/** A Resend sending account: an API key and a from-address on a domain verified in that account. */
export interface EmailAccount {
  readonly apiKey: string;
  readonly fromAddress: string;
}

/** One approved email. */
export interface OutgoingEmail {
  readonly to: string;
  /** The owner's address, where the customer's reply goes. */
  readonly replyTo: string;
  /** The business's name, shown as the sender. */
  readonly fromName: string;
  readonly subject: string;
  readonly text: string;
}

/** A display name safe inside a From header: no quotes, angle brackets or line breaks. */
function displayName(name: string): string {
  return name.replace(/["<>\r\n\\]/g, "").trim().slice(0, 70) || "Anchored";
}

/** Send one email. Returns the provider's message id. Throws `ConnectorError` when the provider refuses. */
export async function sendEmail(account: EmailAccount, email: OutgoingEmail, fetchImpl: FetchLike = fetch): Promise<{ readonly id: string }> {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${account.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `"${displayName(email.fromName)}" <${account.fromAddress}>`,
      to: [email.to],
      reply_to: email.replyTo,
      subject: email.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
      text: email.text,
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      message = ((await response.json()) as { message?: string }).message ?? message;
    } catch {
      // No JSON body; the status says enough.
    }
    throw new ConnectorError(`The email service didn't send it (${message}).`, response.status >= 500 || response.status === 429);
  }
  const sent = (await response.json()) as { id?: string };
  if (typeof sent.id !== "string") throw new ConnectorError("The email service accepted it but sent back no message id.", false);
  return { id: sent.id };
}
