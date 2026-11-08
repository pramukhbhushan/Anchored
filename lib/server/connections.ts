import "server-only";
import type { NextResponse } from "next/server";
import type { ApiError, ConnectionView, ConnectionsResponse, ConnectRequest, SaveContactRequest } from "@/lib/api/contract";
import type { Viewer } from "@/lib/auth/viewer";
import { checkTwilioNumber } from "@/lib/connectors/twilio";
import { CONNECTION_KINDS, type ConnectionKind } from "@/lib/domain/connections";
import { isEmailAddress, normalizePhone, type Contact } from "@/lib/domain/contacts";
import type { BusinessProfile } from "@/lib/domain/types";
import { getStore } from "@/lib/store";
import type { StoredConnection } from "@/lib/store/types";
import { findBusiness } from "./data";
import { fail, handleError, json } from "./http";
import { canStoreSecrets, encryptSecret, newHookId } from "./secrets";
import { findViewer, getSessionId } from "./session";

// =============================================================================
// Module Overview
// =============================================================================
// The Connections page's server side. `connectionViews` says, for each service,
// whether it is connected, what the owner pastes into the service's own
// settings, and why this server can't offer it, with no secret in any view.
// `connect` and `disconnect` save and remove a service, encrypting its
// credentials first. `saveContactFromOwner` checks a customer the owner typed in
// and keeps the date of their texting OK unless its source changed.
// `answerConnections` runs the checks every connections route shares.

type Env = Readonly<Record<string, string | undefined>>;

/** A request the owner can fix, with the HTTP status and the words to show them. */
export class ConnectError extends Error {
  override readonly name = "ConnectError";
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Checks a Twilio Account SID, auth token and number before they are saved: an owner-facing problem, or `null` when they work. */
export type TwilioCheck = (accountSid: string, authToken: string, phone: string) => Promise<string | null>;

/** The live Twilio check: the credentials work and the number is in that account. */
export const TWILIO_CHECK: TwilioCheck = (accountSid, authToken, phone) => checkTwilioNumber(accountSid, authToken, phone);

const EXAMPLE_REFUSAL = "The example business can't connect services. Set up your business first.";
const GUEST_REFUSAL = "Save your work with an email or Google account first, so the services you connect stay yours.";
const NO_SECRETS = "This server can't store credentials yet. Set CONNECTOR_SECRET_KEY.";

// =============================================================================
// Who may connect, and where the webhooks point
// =============================================================================

/** Why this visitor can't connect services, or `null` when they can: an account, or a guest on a server that allows guest connections. */
export function connectBlocked(viewer: Viewer | null): string | null {
  if (viewer !== null && viewer.authEnabled && !viewer.isGuest) return null;
  if (viewer !== null && !viewer.authEnabled && process.env.ANCHORED_ALLOW_GUEST_CONNECTIONS === "1") return null;
  return GUEST_REFUSAL;
}

/** The address outside services call back: `PUBLIC_APP_URL` when set, else the origin `from` names, else empty. */
export function appBaseUrl(from?: Request | Headers): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (from instanceof Request) return new URL(from.url).origin;
  const host = from?.get("x-forwarded-host") ?? from?.get("host");
  if (!host) return "";
  const proto = from?.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The forwarding address for `hookId` on the inbound address `inbound`, such as "abc123+hook@inbound.postmarkapp.com", or `null` when `inbound` isn't one address. */
export function forwardingAddress(hookId: string, inbound: string): string | null {
  const trimmed = inbound.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || !isEmailAddress(trimmed)) return null;
  return `${trimmed.slice(0, at)}+${hookId}@${trimmed.slice(at + 1)}`;
}

/** Why this server can't offer `kind`, or `null` when it can. */
function unavailableReason(kind: ConnectionKind, env: Env): string | null {
  switch (kind) {
    case "texting":
    case "stripe":
      return canStoreSecrets(env) ? null : NO_SECRETS;
    case "email-out":
      return env.RESEND_API_KEY?.trim() && env.EMAIL_FROM_ADDRESS?.trim() ? null : "Email sending isn't set up on this server yet.";
    case "email-in":
      return env.INBOUND_EMAIL_ADDRESS && forwardingAddress("x", env.INBOUND_EMAIL_ADDRESS) !== null ? null : "Email forwarding isn't set up on this server yet.";
  }
}

// =============================================================================
// The views
// =============================================================================

/** Build the view of one service from its stored connection, if any. */
function viewOf(kind: ConnectionKind, stored: StoredConnection | undefined, base: string, env: Env): ConnectionView {
  const unavailable = unavailableReason(kind, env);
  if (stored === undefined) return { kind, connected: false, detail: null, setup: [], unavailable };
  const hook = stored.hookId;
  switch (kind) {
    case "texting":
      return {
        kind,
        connected: true,
        detail: stored.settings.phone ?? null,
        setup: [
          { label: "When a message comes in", value: `${base}/api/hooks/twilio/${hook}/sms` },
          { label: "When a call comes in", value: `${base}/api/hooks/twilio/${hook}/voice` },
        ],
        unavailable,
      };
    case "email-out":
      return { kind, connected: true, detail: stored.settings.replyTo ?? null, setup: [], unavailable };
    case "email-in": {
      const address = env.INBOUND_EMAIL_ADDRESS ? forwardingAddress(hook, env.INBOUND_EMAIL_ADDRESS) : null;
      return { kind, connected: true, detail: address, setup: address === null ? [] : [{ label: "Forward customer emails to", value: address }], unavailable };
    }
    case "stripe":
      return {
        kind,
        connected: true,
        detail: null,
        setup: [
          { label: "Stripe webhook endpoint", value: `${base}/api/hooks/stripe/${hook}` },
          { label: "Events to send", value: "invoice.overdue, invoice.payment_failed" },
        ],
        unavailable,
      };
  }
}

/** Return every service's view for `business`, in page order. `base` is where webhooks point. Views never hold a secret. */
export async function connectionViews(session: string, business: BusinessProfile, base: string): Promise<ConnectionView[]> {
  const stored = await getStore().listConnections(session, business.id);
  return CONNECTION_KINDS.map((kind) => viewOf(kind, stored.find((connection) => connection.kind === kind), base, process.env));
}

// =============================================================================
// Connecting and disconnecting
// =============================================================================

/** Save the service `request` names for `business`, replacing any earlier connection of that kind. Throws `ConnectError` for a problem the owner can fix. */
export async function connect(session: string, business: BusinessProfile, request: ConnectRequest, verifyTexting: TwilioCheck = TWILIO_CHECK): Promise<void> {
  const unavailable = unavailableReason(request.kind, process.env);
  if (unavailable !== null) throw new ConnectError(409, unavailable);
  const base = { businessId: business.id, kind: request.kind, hookId: newHookId() };
  const store = getStore();
  switch (request.kind) {
    case "texting": {
      const phone = normalizePhone(request.phone);
      if (phone === null) throw new ConnectError(400, "Enter the Twilio number in a form like +1 301 555 0192.");
      const problem = await verifyTexting(request.accountSid, request.authToken, phone);
      if (problem !== null) throw new ConnectError(400, problem);
      await store.saveConnection(session, {
        ...base,
        settings: { phone, accountSid: request.accountSid },
        secret: encryptSecret(JSON.stringify({ authToken: request.authToken })),
      });
      return;
    }
    case "email-out":
      await store.saveConnection(session, { ...base, settings: { replyTo: request.replyTo }, secret: null });
      return;
    case "email-in":
      await store.saveConnection(session, { ...base, settings: {}, secret: null });
      return;
    case "stripe":
      await store.saveConnection(session, { ...base, settings: {}, secret: encryptSecret(request.signingSecret) });
      return;
  }
}

/** Remove the business's connection of `kind`, if it has one. */
export async function disconnect(session: string, businessId: string, kind: ConnectionKind): Promise<void> {
  await getStore().deleteConnection(session, businessId, kind);
}

// =============================================================================
// Contacts
// =============================================================================

/** Check and save a customer the owner typed in. `existing` is the business's contacts now; `now` dates a new or changed texting OK. */
export async function saveContactFromOwner(session: string, businessId: string, request: SaveContactRequest, existing: readonly Contact[], now: string): Promise<Contact> {
  const rawPhone = request.phone?.trim() ?? "";
  const phone = rawPhone === "" ? null : normalizePhone(rawPhone);
  if (rawPhone !== "" && phone === null) throw new ConnectError(400, "Enter the phone number in a form like (301) 555-0192.");
  const rawEmail = request.email?.trim() ?? "";
  if (rawEmail !== "" && !isEmailAddress(rawEmail)) throw new ConnectError(400, "Enter the email address in a form like dana@example.com.");
  const email = rawEmail === "" ? null : rawEmail;
  if (phone === null && email === null) throw new ConnectError(400, "Enter a phone number or an email address for this customer.");

  const previous = request.id !== undefined ? existing.find((contact) => contact.id === request.id) : existing.find((contact) => phone !== null && contact.phone === phone);
  if (request.id !== undefined && previous === undefined) throw new ConnectError(404, "That customer isn't on your list anymore. Reload the page and try again.");

  const consent =
    request.consent === null ? null : previous?.consent?.source === request.consent ? previous.consent : { source: request.consent, at: now };
  return getStore().saveContact(session, {
    id: previous?.id,
    businessId,
    name: request.name.trim(),
    phone,
    email,
    consent,
    optedOutAt: previous?.optedOutAt ?? null,
  });
}

/** Save a customer the owner typed in, checked against the business's contacts as they are now. */
export async function saveOwnerContact(session: string, businessId: string, request: SaveContactRequest): Promise<Contact> {
  const existing = await getStore().listContacts(session, businessId);
  return saveContactFromOwner(session, businessId, request, existing, new Date().toISOString());
}

/** Remove one customer from the business's list. */
export async function removeContact(session: string, businessId: string, contactId: string): Promise<void> {
  await getStore().deleteContact(session, businessId, contactId);
}

// =============================================================================
// What every connections route shares
// =============================================================================

/** Return the page's data for `business`: whether the visitor may connect, every service and every contact. */
export async function connectionsResponse(session: string, business: BusinessProfile, viewer: Viewer | null, base: string): Promise<ConnectionsResponse> {
  const [connections, contacts] = await Promise.all([connectionViews(session, business, base), getStore().listContacts(session, business.id)]);
  return { blocked: business.kind === "case" ? EXAMPLE_REFUSAL : connectBlocked(viewer), connections, contacts };
}

/** What a connections route asks of `answerConnections`. */
export interface ConnectionsCall {
  readonly request: Request;
  readonly businessId: string;
  /** The route's name for the server log, such as "PUT /api/businesses/[id]/connections". */
  readonly route: string;
  /** The change to make before answering. Without one, the route only reads, and anyone who owns the business may. */
  readonly change?: (session: string, business: BusinessProfile) => Promise<void>;
}

/** Run a connections route: find the business, refuse the example and blocked visitors a change, make it, and answer with the page's data. */
export async function answerConnections({ request, businessId, route, change }: ConnectionsCall): Promise<NextResponse<ConnectionsResponse | ApiError>> {
  try {
    const business = await findBusiness(businessId);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    const viewer = await findViewer();
    const session = await getSessionId();
    if (change !== undefined) {
      if (business.kind === "case") return fail(409, EXAMPLE_REFUSAL);
      const blocked = connectBlocked(viewer);
      if (blocked !== null) return fail(403, blocked);
      await change(session, business);
    }
    return json(await connectionsResponse(session, business, viewer, appBaseUrl(request)));
  } catch (error) {
    if (error instanceof ConnectError) return fail(error.status, error.message);
    return handleError(error, route);
  }
}
