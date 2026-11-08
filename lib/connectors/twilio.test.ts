import { describe, expect, it } from "vitest";
import { ConnectorError, type FetchLike } from "./errors";
import { checkTwilioNumber, sendTwilioText, twilioSignature, twimlDialOwner, twimlSayAndHangUp, verifyTwilioRequest, type TwilioAccount } from "./twilio";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the Twilio adapter: webhook signatures match Twilio's documented
// example and refuse a changed field or a missing header, texts go out as the
// form Twilio expects, known error codes become plain words for the owner, and
// TwiML escapes what it says.

const ACCOUNT: TwilioAccount = { accountSid: "AC123", authToken: "secret-token", from: "+13015550100" };

/** A fake `fetch` that records each request and answers with `status` and `body`. */
function fakeFetch(status: number, body: unknown): FetchLike & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return Object.assign(impl, { calls });
}

/** The header value a request sent under `name`. */
function header(init: RequestInit | undefined, name: string): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.[name];
}

/** The error a promise rejects with. */
async function rejection(promise: Promise<unknown>): Promise<ConnectorError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ConnectorError);
  return error as ConnectorError;
}

describe("verifyTwilioRequest", () => {
  // Twilio's documented example in "Webhooks security".
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };

  it("matches Twilio's documented signature", () => {
    expect(twilioSignature("12345", url, params)).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
    expect(verifyTwilioRequest("12345", url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(true);
  });

  it("refuses a request whose fields were changed", () => {
    expect(verifyTwilioRequest("12345", url, { ...params, Digits: "9999" }, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(false);
  });

  it("refuses the wrong auth token and a missing header", () => {
    expect(verifyTwilioRequest("54321", url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(false);
    expect(verifyTwilioRequest("12345", url, params, null)).toBe(false);
  });
});

describe("sendTwilioText", () => {
  it("posts the text as a form with basic auth and returns the message id", async () => {
    const fetchImpl = fakeFetch(201, { sid: "SM42" });
    await expect(sendTwilioText(ACCOUNT, "+13015550192", "Hi Dana. Reply STOP to opt out.", fetchImpl)).resolves.toEqual({ id: "SM42" });

    const [call] = fetchImpl.calls;
    expect(call?.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(call?.init?.method).toBe("POST");
    expect(header(call?.init, "authorization")).toBe(`Basic ${Buffer.from("AC123:secret-token").toString("base64")}`);
    expect(header(call?.init, "content-type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(String(call?.init?.body)))).toEqual({
      To: "+13015550192",
      From: "+13015550100",
      Body: "Hi Dana. Reply STOP to opt out.",
    });
  });

  it.each([
    [21610, "texted STOP"],
    [30034, "isn't registered for texting yet"],
    [20003, "refused your Account SID or auth token"],
  ])("turns Twilio error %i into words the owner can act on", async (code, words) => {
    const error = await rejection(sendTwilioText(ACCOUNT, "+13015550192", "Hi", fakeFetch(400, { code, message: "raw Twilio text" })));
    expect(error.message).toContain(words);
    expect(error.message).not.toContain("raw Twilio text");
    expect(error.retryable).toBe(false);
  });

  it("says a Twilio outage may work later", async () => {
    const error = await rejection(sendTwilioText(ACCOUNT, "+13015550192", "Hi", fakeFetch(503, { message: "Service unavailable" })));
    expect(error.retryable).toBe(true);
    expect(error.message).toContain("Service unavailable");
  });

  it("refuses a success with no message id", async () => {
    const error = await rejection(sendTwilioText(ACCOUNT, "+13015550192", "Hi", fakeFetch(201, {})));
    expect(error.retryable).toBe(false);
  });
});

describe("checkTwilioNumber", () => {
  it("looks the number up in the account and finds no problem", async () => {
    const fetchImpl = fakeFetch(200, { incoming_phone_numbers: [{ phone_number: "+13015550100" }] });
    await expect(checkTwilioNumber("AC123", "secret-token", "+13015550100", fetchImpl)).resolves.toBeNull();

    const [call] = fetchImpl.calls;
    expect(call?.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/IncomingPhoneNumbers.json?PhoneNumber=%2B13015550100");
    expect(header(call?.init, "authorization")).toBe(`Basic ${Buffer.from("AC123:secret-token").toString("base64")}`);
  });

  it("explains a number that isn't in the account", async () => {
    await expect(checkTwilioNumber("AC123", "secret-token", "+13015550100", fakeFetch(200, { incoming_phone_numbers: [] }))).resolves.toContain("isn't in this Twilio account");
  });

  it("explains refused credentials", async () => {
    await expect(checkTwilioNumber("AC123", "wrong", "+13015550100", fakeFetch(401, {}))).resolves.toContain("didn't accept");
  });

  it("explains when Twilio can't be reached", async () => {
    const offline: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(checkTwilioNumber("AC123", "secret-token", "+13015550100", offline)).resolves.toContain("couldn't reach Twilio");
  });
});

describe("twimlSayAndHangUp", () => {
  it("escapes what it says and hangs up", () => {
    const twiml = twimlSayAndHangUp(`Tom & Jerry's <HVAC> "shop"`);
    expect(twiml).toContain("<Say>Tom &amp; Jerry&apos;s &lt;HVAC&gt; &quot;shop&quot;</Say><Hangup/>");
    expect(twiml).not.toContain("<HVAC>");
  });

  it("hangs up without speaking when there is nothing to say", () => {
    expect(twimlSayAndHangUp(null)).toBe(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
  });
});

describe("twimlDialOwner", () => {
  it("rings for 20 seconds and escapes the result URL", () => {
    const twiml = twimlDialOwner("+13015550101", "https://anchored.test/voice-result?a=1&b=2");

    expect(twiml).toContain('<Dial timeout="20"');
    expect(twiml).toContain('action="https://anchored.test/voice-result?a=1&amp;b=2"');
    expect(twiml).toContain("<Number>+13015550101</Number>");
    expect(twiml).not.toMatch(/Record|Gather/);
  });
});
