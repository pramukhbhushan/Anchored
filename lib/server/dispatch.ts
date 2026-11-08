import "server-only";
import type { OutboxEntry } from "@/lib/api/contract";
import { ConnectorError, type FetchLike } from "@/lib/connectors/errors";
import { emailAccountFromEnv, sendEmail } from "@/lib/connectors/email";
import { sendTwilioText } from "@/lib/connectors/twilio";
import { deliveryFor, type Delivery, type SendingSetup } from "@/lib/domain/contacts";
import { checkSend, OWNER_TIME_ZONE } from "@/lib/domain/executor";
import type { Store, StoredConnection } from "@/lib/store/types";
import { canStoreSecrets, decryptSecret } from "@/lib/server/secrets";

// =============================================================================
// Module Overview
// =============================================================================
// The one place Anchored sends. `planDelivery` decides, when the owner
// approves, whether Anchored sends a message itself or leaves it to the owner.
// `dispatchEntry` sends one queued outbox entry: it claims the entry so no
// other sender takes it, runs `checkSend` again, since quiet hours or a STOP
// may have arrived since approval, then sends through the connected service
// and records what happened. `dispatchDue` runs every due entry for the cron.

const HOUR_MS = 60 * 60 * 1000;

/** What a business has connected for sending, read from its connections and the server's settings. */
function sendingSetup(connections: readonly StoredConnection[], env: Readonly<Record<string, string | undefined>>): SendingSetup {
  const texting = connections.some((connection) => connection.kind === "texting" && connection.secret !== null) && canStoreSecrets(env);
  const email = connections.some((connection) => connection.kind === "email-out") && emailAccountFromEnv(env) !== null;
  return { texting, email };
}

/** Decide who sends an approved message for a business: Anchored, through a connected service, or the owner. */
export async function planDelivery(
  store: Store,
  session: string,
  businessId: string,
  message: { readonly channel: string; readonly to: string },
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Delivery> {
  const [connections, contacts] = await Promise.all([store.listConnections(session, businessId), store.listContacts(session, businessId)]);
  return deliveryFor(message, sendingSetup(connections, env), contacts);
}

/** What one dispatch did with an entry. */
export type DispatchOutcome = "sent" | "failed" | "yours" | "requeued" | "skipped";

/** Read the texting connection's auth token. */
function twilioToken(connection: StoredConnection, env: Readonly<Record<string, string | undefined>>): string {
  const parsed = JSON.parse(decryptSecret(connection.secret ?? "", env)) as { authToken?: unknown };
  if (typeof parsed.authToken !== "string") throw new Error("The stored Twilio credentials are incomplete. Reconnect texting.");
  return parsed.authToken;
}

/** Send one queued entry, if it is still queued, and record the result. */
export async function dispatchEntry(
  store: Store,
  session: string,
  entryId: string,
  now: Date,
  deps: { readonly fetch?: FetchLike; readonly env?: Readonly<Record<string, string | undefined>> } = {},
): Promise<DispatchOutcome> {
  const env = deps.env ?? process.env;
  const entry = await store.claimOutbox(session, entryId);
  if (entry === null) return "skipped";
  const settle = (delivery: OutboxEntry["delivery"], note: string | null, extra: { providerId?: string; sentAt?: string } = {}) =>
    store.settleOutbox(session, entry.id, { delivery, note, ...extra });
  try {
    const [card, business, connections, contacts] = await Promise.all([
      store.getCard(session, entry.cardId),
      store.getBusiness(session, entry.businessId),
      store.listConnections(session, entry.businessId),
      store.listContacts(session, entry.businessId),
    ]);
    if (card === null || business === null) {
      await settle("failed", "The card or business behind this message was deleted, so it wasn't sent.");
      return "failed";
    }
    // The rules again, on the words that will actually go out: quiet hours or a new STOP may apply now.
    const check = checkSend({ ...card, body: entry.body, channel: entry.channel }, { now, timeZone: OWNER_TIME_ZONE, hasConsent: true });
    if (!check.ok) {
      if (check.reason.startsWith("Quiet hours")) {
        await settle("queued", null, { sentAt: nextDaytimeHour(card, entry.body, now).toISOString() });
        return "requeued";
      }
      await settle("failed", check.reason);
      return "failed";
    }
    const delivery = deliveryFor(entry, sendingSetup(connections, env), contacts);
    if (delivery.by === "owner") {
      await settle("yours", delivery.reason);
      return "yours";
    }
    const id = await send(entry, delivery.to, business.name, connections, env, deps.fetch ?? fetch);
    await settle("sent", null, { providerId: id, sentAt: now.toISOString() });
    return "sent";
  } catch (error) {
    // A provider's refusal is written for the owner; anything else gets a plain fallback and a log line.
    if (!(error instanceof ConnectorError)) console.error(`[Dispatch] Sending outbox entry ${entry.id} failed.`, error);
    await settle("failed", error instanceof ConnectorError ? error.message : "Anchored couldn't send this one. Send it yourself, or try again later.");
    return "failed";
  }
}

/** Send through the connected service for the entry's channel. Returns the provider's message id. */
async function send(
  entry: OutboxEntry,
  to: string,
  businessName: string,
  connections: readonly StoredConnection[],
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: FetchLike,
): Promise<string> {
  if (entry.channel === "sms") {
    const texting = connections.find((connection) => connection.kind === "texting");
    const from = texting?.settings.phone;
    const accountSid = texting?.settings.accountSid;
    if (texting === undefined || from === undefined || accountSid === undefined) throw new ConnectorError("Texting isn't connected anymore. Reconnect it, or send this one yourself.", false);
    return (await sendTwilioText({ accountSid, authToken: twilioToken(texting, env), from }, to, entry.body, fetchImpl)).id;
  }
  const account = emailAccountFromEnv(env);
  const replyTo = connections.find((connection) => connection.kind === "email-out")?.settings.replyTo;
  if (account === null || replyTo === undefined) throw new ConnectorError("Email sending isn't connected anymore. Send this one yourself.", false);
  return (await sendEmail(account, { to, replyTo, fromName: businessName, subject: `A note from ${businessName}`, text: entry.body }, fetchImpl)).id;
}

/** The first whole hour after `now` when quiet hours allow the text. */
function nextDaytimeHour(card: Parameters<typeof checkSend>[0], body: string, now: Date): Date {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let hours = 1; hours <= 24; hours += 1) {
    const candidate = new Date(start.getTime() + hours * HOUR_MS);
    if (checkSend({ ...card, body }, { now: candidate, timeZone: OWNER_TIME_ZONE, hasConsent: true }).ok) return candidate;
  }
  return new Date(now.getTime() + 12 * HOUR_MS);
}

/** Send every queued entry due by `now`, across all sessions, and count the outcomes. */
export async function dispatchDue(store: Store, now: Date, limit = 50, deps: Parameters<typeof dispatchEntry>[4] = {}): Promise<Record<DispatchOutcome, number>> {
  const counts: Record<DispatchOutcome, number> = { sent: 0, failed: 0, yours: 0, requeued: 0, skipped: 0 };
  for (const { session, entry } of await store.listDueOutbox(now.toISOString(), limit)) {
    counts[await dispatchEntry(store, session, entry.id, now, deps)] += 1;
  }
  return counts;
}
