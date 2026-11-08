import "server-only";
import type { ConnectionKind } from "@/lib/domain/connections";
import { applyOptOut, contactByPhone, normalizePhone, optOutKeyword } from "@/lib/domain/contacts";
import type { BusinessProfile } from "@/lib/domain/types";
import { ingestEvent, type IngestResult } from "@/lib/server/ingest";
import { triageEmail, type TriageEmail } from "@/lib/server/triage";
import { getStore } from "@/lib/store";
import type { StoredConnection } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// What the signed webhooks under `app/api/hooks/` do once a provider's
// signature checks out. `connectionFor` finds the business a hook id names,
// across sessions. A customer's text updates their contact: STOP and START
// change whether Anchored may text them, and anything else becomes a reply
// draft. A missed call, an unpaid Stripe invoice and a forwarded email each
// become a draft through `ingestEvent`, except the email, which Inbox Triage in
// `lib/server/triage.ts` files under the agent whose work it is.

/** The connection, business and owning session a webhook's hook id names. */
export interface HookTarget {
  readonly session: string;
  readonly connection: StoredConnection;
  readonly business: BusinessProfile;
}

/** Find what `hookId` names, or `null` when it names nothing of `kind`. */
export async function connectionFor(hookId: string, kind: ConnectionKind): Promise<HookTarget | null> {
  // Hook ids are 24 random letters and digits; anything else can't name a connection.
  if (!/^[a-z0-9]{24}$/.test(hookId)) return null;
  const store = getStore();
  const found = await store.findConnection(hookId);
  if (found === null || found.connection.kind !== kind) return null;
  const business = await store.getBusiness(found.session, found.connection.businessId);
  return business === null ? null : { session: found.session, connection: found.connection, business };
}

/** The URL a provider signed: the public address when `PUBLIC_APP_URL` is set, else the URL the request arrived at. */
export function signedUrl(request: Request, env: Readonly<Record<string, string | undefined>> = process.env): string {
  const base = env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!base) return request.url;
  const url = new URL(request.url);
  return `${base}${url.pathname}${url.search}`;
}

/** What a customer's text did. */
export type TextOutcome = "opted-out" | "opted-in" | "drafted" | "ignored";

/** Handle a customer's text: STOP and START update their contact; anything else becomes a reply draft. */
export async function receiveText(target: HookTarget, rawFrom: string, body: string, now: Date): Promise<TextOutcome> {
  const store = getStore();
  const from = normalizePhone(rawFrom);
  if (from === null) return "ignored";
  const { session, business } = target;
  const at = now.toISOString();
  const known = contactByPhone(await store.listContacts(session, business.id), from);
  const contact = known ?? { businessId: business.id, name: from, phone: from, email: null, consent: null, optedOutAt: null };
  const keyword = optOutKeyword(body);
  if (keyword !== null) {
    await store.saveContact(session, { ...applyOptOut({ id: "", ...contact }, keyword, at), id: known?.id });
    return keyword === "stop" ? "opted-out" : "opted-in";
  }
  // Texting first is the customer's OK to get a reply about what they asked; an earlier source is kept.
  await store.saveContact(session, { ...contact, consent: contact.consent ?? { source: "texted-first", at } });
  const result = await ingestEvent(session, business, "text", { from, text: body.trim().slice(0, 1600) || "(empty text)", ...(known && known.name !== from ? { name: known.name.slice(0, 80) } : {}) }, "live");
  return logged(result, "text") ? "drafted" : "ignored";
}

/** Handle a call that rang through to the business's Twilio number, which is a call the owner missed. */
export async function receiveMissedCall(target: HookTarget, rawFrom: string): Promise<boolean> {
  const from = normalizePhone(rawFrom);
  if (from === null) return false;
  const store = getStore();
  const { session, business } = target;
  // A caller hasn't agreed to texts, so the contact is kept without consent; the owner can add it.
  if (contactByPhone(await store.listContacts(session, business.id), from) === undefined) {
    await store.saveContact(session, { businessId: business.id, name: from, phone: from, email: null, consent: null, optedOutAt: null });
  }
  return logged(await ingestEvent(session, business, "missed-call", { from }, "live"), "missed-call");
}

/** Draft a reminder for an unpaid Stripe invoice. */
export async function receiveUnpaidInvoice(
  target: HookTarget,
  invoice: { readonly kind: "overdue" | "failed"; readonly customerName: string | null; readonly customerEmail: string | null; readonly amountDue: number; readonly number: string | null },
): Promise<boolean> {
  const payload = {
    kind: invoice.kind,
    amount: invoice.amountDue,
    ...(invoice.customerName ? { name: invoice.customerName } : {}),
    ...(invoice.customerEmail ? { email: invoice.customerEmail } : {}),
    ...(invoice.number ? { number: invoice.number } : {}),
  };
  return logged(await ingestEvent(target.session, target.business, "invoice-late", payload, "live"), "invoice-late");
}

/** Hand a forwarded email to Inbox Triage, which files it under the agent whose work it is. */
export async function receiveEmail(target: HookTarget, email: TriageEmail): Promise<boolean> {
  await triageEmail(target.session, target.business, email);
  return true;
}

/** Whether a card was drafted; a refusal is logged, since the provider only needs to know the webhook arrived. */
function logged(result: IngestResult, source: string): boolean {
  if (!result.ok) console.warn(`[Webhook] No card drafted for a ${source} event: ${result.error}`);
  return result.ok;
}
