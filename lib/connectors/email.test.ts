import { describe, expect, it } from "vitest";
import { readInboundEmail, sendEmail, type EmailAccount, type OutgoingEmail } from "./email";
import { ConnectorError, type FetchLike } from "./errors";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the email adapter: an approved email goes to Resend as JSON
// under the business's name with the owner as reply-to, a refusal becomes an
// owner-facing error, Postmark's inbound JSON reads into plain fields, and the
// sending account comes from the environment.

const ACCOUNT: EmailAccount = { apiKey: "re_test", fromAddress: "send@anchored.example" };
const EMAIL: OutgoingEmail = {
  to: "sam@example.com",
  replyTo: "owner@shop.example",
  fromName: "Bay Ridge HVAC",
  subject: "Your quote",
  text: "Hi Sam, here is the quote we talked about.",
};

/** A fake `fetch` that records each request and answers with `status` and `body`. */
function fakeFetch(status: number, body: unknown): FetchLike & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return Object.assign(impl, { calls });
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

describe("sendEmail", () => {
  it("posts JSON to Resend with the bearer key and returns the message id", async () => {
    const fetchImpl = fakeFetch(200, { id: "em_42" });
    await expect(sendEmail(ACCOUNT, EMAIL, fetchImpl)).resolves.toEqual({ id: "em_42" });

    const [call] = fetchImpl.calls;
    expect(call?.url).toBe("https://api.resend.com/emails");
    expect(call?.init?.method).toBe("POST");
    expect((call?.init?.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(call?.init?.body))).toEqual({
      from: `"Bay Ridge HVAC" <send@anchored.example>`,
      to: ["sam@example.com"],
      reply_to: "owner@shop.example",
      subject: "Your quote",
      text: "Hi Sam, here is the quote we talked about.",
    });
  });

  it("keeps quotes, angle brackets and line breaks out of the headers", async () => {
    const fetchImpl = fakeFetch(200, { id: "em_43" });
    await sendEmail(ACCOUNT, { ...EMAIL, fromName: `Evil" <x@y>\r\nBcc: a@b`, subject: "Line one\r\nBcc: a@b" }, fetchImpl);
    const sent = JSON.parse(String(fetchImpl.calls[0]?.init?.body)) as { from: string; subject: string };
    expect(sent.from).toBe(`"Evil x@yBcc: a@b" <send@anchored.example>`);
    expect(sent.subject).toBe("Line one Bcc: a@b");
  });

  it("passes on Resend's reason when it refuses", async () => {
    const error = await rejection(sendEmail(ACCOUNT, EMAIL, fakeFetch(422, { message: "The domain is not verified." })));
    expect(error.message).toBe("The email service didn't send it (The domain is not verified.).");
    expect(error.retryable).toBe(false);
  });

  it("says an outage or a rate limit may work later", async () => {
    expect((await rejection(sendEmail(ACCOUNT, EMAIL, fakeFetch(502, {})))).retryable).toBe(true);
    expect((await rejection(sendEmail(ACCOUNT, EMAIL, fakeFetch(429, {})))).retryable).toBe(true);
  });
});

describe("readInboundEmail", () => {
  const postmark = {
    From: "dana@example.com",
    FromName: "Dana Lee",
    Subject: "Re: your estimate",
    TextBody: "Sounds good.\n\nOn Tue, you wrote:\n> the old message",
    StrippedTextReply: "Sounds good.",
    MailboxHash: "abc123",
    Attachments: [{ Name: "photo.jpg" }],
  };

  it("reads Postmark's fields and prefers the reply without the quoted thread", () => {
    expect(readInboundEmail(postmark)).toEqual({
      mailbox: "abc123",
      from: "dana@example.com",
      fromName: "Dana Lee",
      subject: "Re: your estimate",
      text: "Sounds good.",
      messageId: null,
    });
  });

  it("keeps Postmark's message id, so a repeated delivery is handled once, and drops a malformed one", () => {
    expect(readInboundEmail({ ...postmark, MessageID: "73e6d360-66eb-11e1-8e72-a8904824019b" })?.messageId).toBe("73e6d360-66eb-11e1-8e72-a8904824019b");
    expect(readInboundEmail({ ...postmark, MessageID: "not an id; drop table" })?.messageId).toBeNull();
  });

  it("falls back to the full body and a placeholder subject", () => {
    const read = readInboundEmail({ From: "dana@example.com", TextBody: "Can you come Friday?", MailboxHash: "abc123" });
    expect(read).toMatchObject({ fromName: null, subject: "(no subject)", text: "Can you come Friday?" });
  });

  it("returns null without a mailbox hash or for something that isn't an email", () => {
    expect(readInboundEmail({ ...postmark, MailboxHash: undefined })).toBeNull();
    expect(readInboundEmail({ ...postmark, MailboxHash: "" })).toBeNull();
    expect(readInboundEmail({ hello: "world" })).toBeNull();
  });
});

