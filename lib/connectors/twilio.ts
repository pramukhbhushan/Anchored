import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ConnectorError, PROVIDER_TIMEOUT_MS, type FetchLike } from "./errors";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's Twilio number: send one approved text, check that a number
// belongs to an account, verify that a webhook really came from Twilio, and
// answer a call with TwiML. Calls are never recorded or transcribed, since
// Maryland requires every party's consent to record one.

/** A Twilio account and the number in it that sends for the business. */
export interface TwilioAccount {
  readonly accountSid: string;
  readonly authToken: string;
  /** The sending number in E.164. */
  readonly from: string;
}

const API = "https://api.twilio.com/2010-04-01";

/** Twilio's signature for a webhook: HMAC-SHA1 over the URL plus each form field's name and value, sorted by name. */
export function twilioSignature(authToken: string, url: string, params: Readonly<Record<string, string>>): string {
  const signed = Object.keys(params)
    .sort()
    .reduce((text, key) => text + key + (params[key] ?? ""), url);
  return createHmac("sha1", authToken).update(signed, "utf8").digest("base64");
}

/** Whether `header`, the `X-Twilio-Signature` value, matches the request Twilio would have signed. */
export function verifyTwilioRequest(authToken: string, url: string, params: Readonly<Record<string, string>>, header: string | null): boolean {
  if (header === null) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function basicAuth(account: Pick<TwilioAccount, "accountSid" | "authToken">): string {
  return `Basic ${Buffer.from(`${account.accountSid}:${account.authToken}`).toString("base64")}`;
}

// Twilio error codes an owner can act on, in plain words.
const TWILIO_ERRORS: Readonly<Record<number, string>> = {
  21211: "Twilio says that phone number isn't valid.",
  21408: "Your Twilio account can't text that country.",
  21610: "This customer texted STOP to your Twilio number, so Twilio won't deliver it.",
  21606: "Your Twilio number can't send texts. Pick a number with texting turned on.",
  21608: "Your Twilio trial account can text only numbers you verified in Twilio.",
  30034: "Your Twilio number isn't registered for texting yet (A2P 10DLC). Finish the registration in Twilio.",
  20003: "Twilio refused your Account SID or auth token. Reconnect texting with the right ones.",
};

/** Turn a failed Twilio response into an error the owner can act on. */
async function twilioFailure(response: Response): Promise<ConnectorError> {
  let detail: { code?: number; message?: string } = {};
  try {
    detail = (await response.json()) as typeof detail;
  } catch {
    // Some failures carry no JSON body; the status alone tells us enough.
  }
  const known = detail.code === undefined ? undefined : TWILIO_ERRORS[detail.code];
  return new ConnectorError(known ?? `Twilio didn't send it (${detail.message ?? `HTTP ${response.status}`}).`, response.status >= 500);
}

/** Send one text from the business's number. Returns Twilio's message id. Throws `ConnectorError` when Twilio refuses. */
export async function sendTwilioText(account: TwilioAccount, to: string, body: string, fetchImpl: FetchLike = fetch): Promise<{ readonly id: string }> {
  const response = await fetchImpl(`${API}/Accounts/${encodeURIComponent(account.accountSid)}/Messages.json`, {
    method: "POST",
    headers: { authorization: basicAuth(account), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: account.from, Body: body }).toString(),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) throw await twilioFailure(response);
  const sent = (await response.json()) as { sid?: string };
  if (typeof sent.sid !== "string") throw new ConnectorError("Twilio accepted the text but sent back no message id.", false);
  return { id: sent.sid };
}

/** Check that the credentials work and that `phone` is a number in the account; return the problem in plain words, or `null`. */
export async function checkTwilioNumber(accountSid: string, authToken: string, phone: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  const url = `${API}/Accounts/${encodeURIComponent(accountSid)}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`;
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { authorization: basicAuth({ accountSid, authToken }) }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch {
    return "Anchored couldn't reach Twilio. Try again in a minute.";
  }
  if (response.status === 401 || response.status === 404) return "Twilio didn't accept that Account SID and auth token.";
  if (!response.ok) return `Twilio answered with an error (HTTP ${response.status}). Try again in a minute.`;
  const found = (await response.json()) as { incoming_phone_numbers?: unknown[] };
  return (found.incoming_phone_numbers?.length ?? 0) > 0 ? null : "That number isn't in this Twilio account. Use a number you bought in Twilio.";
}

/** Escape text for an XML element. */
function xml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** TwiML that says `words` to a caller, if any, then hangs up. Nothing is recorded. */
export function twimlSayAndHangUp(words: string | null): string {
  const say = words === null ? "" : `<Say>${xml(words)}</Say>`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${say}<Hangup/></Response>`;
}

/** TwiML that rings the owner's phone for 20 seconds, then reports the result to `action`. */
export function twimlDialOwner(phone: string, action: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="20" action="${xml(action)}" method="POST"><Number>${xml(phone)}</Number></Dial></Response>`;
}

/** An empty TwiML reply: Twilio sends nothing back to the texter. */
export const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
