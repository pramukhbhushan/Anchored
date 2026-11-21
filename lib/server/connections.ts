import "server-only";
import type { NextResponse } from "next/server";
import type { AiKeyView, ApiError, ConnectionView, ConnectionsResponse, ConnectRequest, SaveAiKeyRequest, SaveContactRequest } from "@/lib/api/contract";
import type { Viewer } from "@/lib/auth/viewer";
import { checkTwilioNumber } from "@/lib/connectors/twilio";
import { AI_PROVIDER_COPY, isAiProvider, SERVICE_KINDS, type ConnectionKind, type ServiceKind } from "@/lib/domain/connections";
import { isEmailAddress, normalizePhone, type Contact } from "@/lib/domain/contacts";
import type { BusinessProfile } from "@/lib/domain/types";
import type { OwnerAiSettings } from "@/lib/llm";
import { getStore } from "@/lib/store";
import type { StoredConnection } from "@/lib/store/types";
import { checkOwnerKey } from "./business-llm";
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
// credentials first. An AI key is checked with one short call to its provider
// before it is saved, and its view shows the provider and the key's last four
// characters, never the key. `saveContactFromOwner` checks a customer the owner typed in
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
type TwilioCheck = (accountSid: string, authToken: string, phone: string) => Promise<string | null>;

/** Checks an owner's AI key before it is saved: an owner-facing problem, or `null` when it works. */
type AiKeyCheck = (owner: OwnerAiSettings) => Promise<string | null>;

const EXAMPLE_REFUSAL = "The example business can't connect services. Set up your business first.";
const GUEST_REFUSAL = "Save your work with an email or Google account first, so the services you connect stay yours.";
// Owners see these; the setting an operator must add goes to the server log instead.
const NO_SECRETS = "Not available yet. Anchored can't keep sign-ins for outside services until its setup is finished.";
const NO_EMAIL_OUT = "Sending email from Anchored isn't available yet.";
const NO_EMAIL_IN = "Forwarding email to Anchored isn't available yet.";
const OPERATOR_FIX: Readonly<Record<ConnectionKind, string>> = {
  ai: "Set CONNECTOR_SECRET_KEY.",
  texting: "Set CONNECTOR_SECRET_KEY.",
  stripe: "Set CONNECTOR_SECRET_KEY.",
  "email-out": "Set CONNECTOR_SECRET_KEY.",
  "email-in": "Set INBOUND_EMAIL_ADDRESS to one address.",
};
const warned = new Set<ConnectionKind>();

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
function forwardingAddress(hookId: string, inbound: string): string | null {
  const trimmed = inbound.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || !isEmailAddress(trimmed)) return null;
  return `${trimmed.slice(0, at)}+${hookId}@${trimmed.slice(at + 1)}`;
}

/** Why this server can't offer `kind` in owner words, or `null` when it can. Logs the operator's fix once per kind. */
function unavailableReason(kind: ConnectionKind, env: Env): string | null {
  const reason = ownerReason(kind, env);
  if (reason !== null && !warned.has(kind)) {
    warned.add(kind);
    console.warn(`[Connections] ${kind} is unavailable on this server. ${OPERATOR_FIX[kind]}`);
  }
  return reason;
}

function ownerReason(kind: ConnectionKind, env: Env): string | null {
  switch (kind) {
    case "ai":
    case "texting":
    case "stripe":
      return canStoreSecrets(env) ? null : NO_SECRETS;
    case "email-out":
      return canStoreSecrets(env) ? null : NO_EMAIL_OUT;
    case "email-in":
      return env.INBOUND_EMAIL_ADDRESS && forwardingAddress("x", env.INBOUND_EMAIL_ADDRESS) !== null ? null : NO_EMAIL_IN;
  }
}

// =============================================================================
// The views
// =============================================================================

/** Build the view of one service from its stored connection, if any. */
function viewOf(kind: ServiceKind, stored: StoredConnection | undefined, base: string, env: Env): ConnectionView {
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
    case "email-out": {
      const { fromAddress, replyTo } = stored.settings;
      const detail = fromAddress === undefined ? (replyTo ?? null) : `${fromAddress}, replies go to ${replyTo ?? fromAddress}`;
      return { kind, connected: true, detail, setup: [], unavailable };
    }
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

/** Build the view of the business's AI key from its stored connection, if any. Never holds the key. */
function aiViewOf(stored: StoredConnection | undefined, env: Env): AiKeyView {
  const provider = stored?.settings.provider;
  const unavailable = unavailableReason("ai", env);
  if (stored === undefined || !isAiProvider(provider)) return { provider: null, lastFour: null, model: null, unavailable };
  return { provider, lastFour: stored.settings.lastFour ?? null, model: stored.settings.model ?? null, unavailable };
}

/** Return the business's AI key view and every service's view, in page order. `base` is where webhooks point. Views never hold a secret. */
export async function connectionViews(session: string, business: BusinessProfile, base: string): Promise<{ ai: AiKeyView; connections: ConnectionView[] }> {
  const stored = await getStore().listConnections(session, business.id);
  const find = (kind: ConnectionKind) => stored.find((connection) => connection.kind === kind);
  return { ai: aiViewOf(find("ai"), process.env), connections: SERVICE_KINDS.map((kind) => viewOf(kind, find(kind), base, process.env)) };
}

// =============================================================================
// Connecting and disconnecting
// =============================================================================

/** Save the service `request` names for `business`, replacing any earlier connection of that kind. Throws `ConnectError` for a problem the owner can fix. */
export async function connect(session: string, business: BusinessProfile, request: ConnectRequest, verifyTexting: TwilioCheck = checkTwilioNumber): Promise<void> {
  const unavailable = unavailableReason(request.kind, process.env);
  if (unavailable !== null) throw new ConnectError(409, unavailable);
  const base = { businessId: business.id, kind: request.kind, hookId: newHookId() };
  const store = getStore();
  switch (request.kind) {
    case "texting": {
      const phone = normalizePhone(request.phone);
      if (phone === null) throw new ConnectError(400, "Enter the Twilio number in a form like +1 301 555 0192.");
      const rawForwardTo = request.forwardTo?.trim() ?? "";
      const forwardTo = rawForwardTo === "" ? null : normalizePhone(rawForwardTo);
      if (rawForwardTo !== "" && forwardTo === null) throw new ConnectError(400, "Enter the phone that should ring in a form like +1 301 555 0192.");
      if (forwardTo === phone) throw new ConnectError(400, "Use the owner's phone for ringing, not the Twilio number itself.");
      const problem = await verifyTexting(request.accountSid, request.authToken, phone);
      if (problem !== null) throw new ConnectError(400, problem);
      await store.saveConnection(session, {
        ...base,
        settings: { phone, accountSid: request.accountSid, ...(forwardTo === null ? {} : { forwardTo }) },
        secret: encryptSecret(JSON.stringify({ authToken: request.authToken })),
      });
      return;
    }
    case "email-out":
      // Email goes out only through the owner's own Resend account, from their own domain.
      await store.saveConnection(session, {
        ...base,
        settings: { replyTo: request.replyTo, fromAddress: request.fromAddress },
        secret: encryptSecret(JSON.stringify({ apiKey: request.apiKey })),
      });
      return;
    case "email-in":
      await store.saveConnection(session, { ...base, settings: {}, secret: null });
      return;
    case "stripe":
      await store.saveConnection(session, { ...base, settings: {}, secret: encryptSecret(request.signingSecret) });
      return;
  }
}

/** Check the owner's AI key with one short call to its provider, then save it for `business`, replacing any earlier key. Throws `ConnectError` for a problem the owner can fix. */
export async function saveAiKey(session: string, business: BusinessProfile, request: SaveAiKeyRequest, verify: AiKeyCheck = checkOwnerKey): Promise<void> {
  const unavailable = unavailableReason("ai", process.env);
  if (unavailable !== null) throw new ConnectError(409, unavailable);
  const { name, needsModel } = AI_PROVIDER_COPY[request.provider];
  const model = request.model?.trim() || null;
  if (model === null && needsModel) throw new ConnectError(400, `${name} needs a model name. Copy the exact name from ${name}.`);
  const problem = await verify({ provider: request.provider, apiKey: request.apiKey, model });
  if (problem !== null) throw new ConnectError(400, problem);
  await getStore().saveConnection(session, {
    businessId: business.id,
    kind: "ai",
    hookId: newHookId(),
    settings: { provider: request.provider, lastFour: request.apiKey.slice(-4), ...(model === null ? {} : { model }) },
    secret: encryptSecret(request.apiKey),
  });
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
  const [views, contacts] = await Promise.all([connectionViews(session, business, base), getStore().listContacts(session, business.id)]);
  return { blocked: business.kind === "case" ? EXAMPLE_REFUSAL : connectBlocked(viewer), ...views, contacts };
}

/** What a connections route asks of `answerConnections`. */
interface ConnectionsCall {
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
