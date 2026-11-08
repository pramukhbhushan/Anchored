import { EMPTY_TWIML, twimlDialOwner, twimlSayAndHangUp, verifyTwilioRequest } from "@/lib/connectors/twilio";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import { handleError } from "@/lib/server/http";
import { connectionFor, receiveMissedCall, receiveText, signedUrl } from "@/lib/server/hooks";
import { decryptSecret } from "@/lib/server/secrets";

// =============================================================================
// Module Overview
// =============================================================================
// Twilio's webhooks for a business's texting number. `/sms` gets each text a
// customer sends; `/voice` gets each call that rang through to the number,
// which with conditional forwarding is a call the owner missed. Each request
// must carry a valid `X-Twilio-Signature` made with the owner's auth token.
// Calls are answered with a short message and never recorded.

type Context = { params: Promise<{ hookId: string; event: string }> };

/** Whether an incoming call should ring the owner now. */
function duringCallHours(now = new Date()): boolean {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: OWNER_TIME_ZONE, hour: "numeric", hourCycle: "h23" })
    .formatToParts(now)
    .find((item) => item.type === "hour");
  const hour = Number(part?.value ?? 0);
  return hour >= 8 && hour < 20;
}

/** The signed public callback URL Twilio uses after trying the owner's phone. */
function resultUrl(request: Request): string {
  const url = new URL(signedUrl(request));
  url.pathname = url.pathname.replace(/\/voice$/, "/voice-result");
  return url.toString();
}

/** A TwiML response. */
function twiml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/xml; charset=utf-8" } });
}

/** Receive a text or a call from Twilio. */
export async function POST(request: Request, { params }: Context) {
  try {
    const { hookId, event } = await params;
    if (event !== "sms" && event !== "voice" && event !== "voice-result") return new Response("Not found", { status: 404 });
    const target = await connectionFor(hookId, "texting");
    if (target === null || target.connection.secret === null) return new Response("Not found", { status: 404 });

    const form = await request.formData();
    const fields: Record<string, string> = {};
    for (const [name, value] of form.entries()) if (typeof value === "string") fields[name] = value;
    const { authToken } = JSON.parse(decryptSecret(target.connection.secret)) as { authToken: string };
    if (!verifyTwilioRequest(authToken, signedUrl(request), fields, request.headers.get("x-twilio-signature"))) {
      return new Response("Signature check failed", { status: 403 });
    }

    const from = fields.From ?? "";
    if (event === "sms") {
      // Twilio's own opt-out handling answers STOP; Anchored records it and sends nothing back here.
      await receiveText(target, from, fields.Body ?? "", new Date());
      return twiml(EMPTY_TWIML);
    }
    if (event === "voice-result") {
      if (fields.DialCallStatus === "completed") return twiml(EMPTY_TWIML);
      await receiveMissedCall(target, from);
      return twiml(twimlSayAndHangUp(`Sorry we missed your call at ${target.business.name}. We'll get back to you soon.`));
    }
    const forwardTo = target.connection.settings.forwardTo;
    if (forwardTo !== undefined && duringCallHours()) {
      return twiml(twimlDialOwner(forwardTo, resultUrl(request)));
    }
    await receiveMissedCall(target, from);
    return twiml(twimlSayAndHangUp(`Sorry we missed your call at ${target.business.name}. We'll get back to you soon.`));
  } catch (error) {
    return handleError(error, "POST /api/hooks/twilio/[hookId]/[event]");
  }
}
