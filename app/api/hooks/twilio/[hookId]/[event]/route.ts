import { EMPTY_TWIML, twimlSayAndHangUp, verifyTwilioRequest } from "@/lib/connectors/twilio";
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

/** A TwiML response. */
function twiml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/xml; charset=utf-8" } });
}

/** Receive a text or a call from Twilio. */
export async function POST(request: Request, { params }: Context) {
  try {
    const { hookId, event } = await params;
    if (event !== "sms" && event !== "voice") return new Response("Not found", { status: 404 });
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
    await receiveMissedCall(target, from);
    return twiml(twimlSayAndHangUp(`Sorry we missed your call at ${target.business.name}. We'll get back to you soon.`));
  } catch (error) {
    return handleError(error, "POST /api/hooks/twilio/[hookId]/[event]");
  }
}
