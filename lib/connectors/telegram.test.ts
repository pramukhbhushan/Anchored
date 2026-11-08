import { describe, expect, it } from "vitest";
import { ConnectorError, type FetchLike } from "./errors";
import {
  deleteTelegramMessage,
  isSafeButtonUrl,
  readTelegramUpdate,
  sendTelegramMessage,
  setTelegramWebhook,
  TelegramBlockedError,
  telegramBotFromEnv,
  telegramLink,
  telegramWebhookInfo,
  verifyTelegramSecret,
  type TelegramBot,
} from "./telegram";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the Telegram adapter: updates read into /start, /stop, texts and
// block changes, with groups and odd shapes ignored; the secret header must
// match exactly; messages go out as plain text with only https buttons; and
// Telegram's refusals become plain words, with a block told apart.

const BOT: TelegramBot = { token: "123:abc", username: "AnchoredBot" };

/** A fake `fetch` that records each request and answers with `status` and `body`. */
function fakeFetch(status: number, body: unknown): FetchLike & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return Object.assign(impl, { calls });
}

/** The JSON body a recorded request sent. */
function sent(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
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

/** A private-chat message update. */
function message(text: string, extra: Record<string, unknown> = {}) {
  return { update_id: 7, message: { message_id: 1, chat: { id: 5551234567, type: "private" }, from: { first_name: "Dana", last_name: "Ruiz" }, text, ...extra } };
}

describe("readTelegramUpdate", () => {
  it("reads /start with the business's hook id and the customer's name", () => {
    expect(readTelegramUpdate(message("/start abc123def456ghi789jkl012"))).toEqual({ kind: "start", updateId: 7, chatId: "5551234567", name: "Dana Ruiz", hookId: "abc123def456ghi789jkl012" });
  });

  it("reads a bare /start, or one with a malformed id, as a start with no hook id", () => {
    expect(readTelegramUpdate(message("/start"))).toMatchObject({ kind: "start", hookId: null });
    expect(readTelegramUpdate(message("/start bad!id"))).toMatchObject({ kind: "start", hookId: null });
  });

  it("reads /stop, including the @bot form groups use", () => {
    expect(readTelegramUpdate(message("/stop"))).toMatchObject({ kind: "stop", chatId: "5551234567" });
    expect(readTelegramUpdate(message("/STOP@AnchoredBot"))).toMatchObject({ kind: "stop" });
  });

  it("reads any other text as the customer's message, trimmed", () => {
    expect(readTelegramUpdate(message("  Do you do weekend tune-ups?  "))).toMatchObject({ kind: "text", text: "Do you do weekend tune-ups?" });
  });

  it("keeps chat ids beyond 32 bits exactly, as strings", () => {
    const update = readTelegramUpdate({ update_id: 8, message: { chat: { id: -1001234567890123, type: "private" }, text: "hi" } });
    expect(update).toMatchObject({ kind: "text", chatId: "-1001234567890123", name: null });
  });

  it("falls back to the username when the customer shows no name", () => {
    expect(readTelegramUpdate(message("hi", { from: { username: "dana_r" } }))).toMatchObject({ name: "dana_r" });
  });

  it("reads a block and an unblock from a private chat", () => {
    const member = (status: string) => ({ update_id: 9, my_chat_member: { chat: { id: 42, type: "private" }, new_chat_member: { status } } });
    expect(readTelegramUpdate(member("kicked"))).toEqual({ kind: "blocked", updateId: 9, chatId: "42" });
    expect(readTelegramUpdate(member("member"))).toEqual({ kind: "unblocked", updateId: 9, chatId: "42" });
  });

  it("ignores groups, photos, empty text and unsupported updates", () => {
    expect(readTelegramUpdate({ update_id: 1, message: { chat: { id: -5, type: "group" }, text: "hi" } }).kind).toBe("ignored");
    expect(readTelegramUpdate({ update_id: 2, message: { chat: { id: 5, type: "private" }, photo: [] } }).kind).toBe("ignored");
    expect(readTelegramUpdate(message("   ")).kind).toBe("ignored");
    expect(readTelegramUpdate({ update_id: 3, edited_message: {} }).kind).toBe("ignored");
  });

  it("refuses a body that isn't an update", () => {
    expect(() => readTelegramUpdate({ hello: "world" })).toThrow(ConnectorError);
    expect(() => readTelegramUpdate(null)).toThrow(ConnectorError);
  });
});

describe("verifyTelegramSecret", () => {
  it("accepts only the exact secret", () => {
    expect(verifyTelegramSecret("s3cret", "s3cret")).toBe(true);
    expect(verifyTelegramSecret("s3cret", "s3cre")).toBe(false);
    expect(verifyTelegramSecret("s3cret", "s3creT")).toBe(false);
  });

  it("refuses a missing header or an unset secret", () => {
    expect(verifyTelegramSecret("s3cret", null)).toBe(false);
    expect(verifyTelegramSecret(undefined, "anything")).toBe(false);
    expect(verifyTelegramSecret("", "")).toBe(false);
  });
});

describe("telegramBotFromEnv and telegramLink", () => {
  it("reads the bot only when both settings are present and the username is valid", () => {
    expect(telegramBotFromEnv({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_BOT_USERNAME: "@AnchoredBot" })).toEqual(BOT);
    expect(telegramBotFromEnv({ TELEGRAM_BOT_TOKEN: "123:abc" })).toBeNull();
    expect(telegramBotFromEnv({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_BOT_USERNAME: "a b" })).toBeNull();
  });

  it("builds the customer link, and refuses malformed parts", () => {
    expect(telegramLink("AnchoredBot", "abc123")).toBe("https://t.me/AnchoredBot?start=abc123");
    expect(telegramLink("AnchoredBot", "abc 123")).toBeNull();
    expect(telegramLink("x", "abc123")).toBeNull();
  });
});

describe("isSafeButtonUrl", () => {
  it("allows only https links to the listed hosts", () => {
    expect(isSafeButtonUrl("https://g.page/r/abc", ["g.page"])).toBe(true);
    expect(isSafeButtonUrl("http://g.page/r/abc", ["g.page"])).toBe(false);
    expect(isSafeButtonUrl("https://evil.example/r", ["g.page"])).toBe(false);
    expect(isSafeButtonUrl("https://user:pw@g.page/r", ["g.page"])).toBe(false);
    expect(isSafeButtonUrl("javascript:alert(1)", ["g.page"])).toBe(false);
    expect(isSafeButtonUrl("not a url", ["g.page"])).toBe(false);
  });
});

describe("sendTelegramMessage", () => {
  it("sends plain text with no parse mode and returns the message id", async () => {
    const fetch = fakeFetch(200, { ok: true, result: { message_id: 99 } });
    expect(await sendTelegramMessage(BOT, "42", "Hi *there*", [], fetch)).toEqual({ id: "99" });
    expect(fetch.calls[0]?.url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    const body = sent(fetch.calls[0]?.init);
    expect(body).toMatchObject({ chat_id: "42", text: "Hi *there*" });
    expect(body).not.toHaveProperty("parse_mode");
    expect(body).not.toHaveProperty("reply_markup");
  });

  it("puts each button on its own row", async () => {
    const fetch = fakeFetch(200, { ok: true, result: { message_id: 1 } });
    await sendTelegramMessage(BOT, "42", "Leave a review?", [{ text: "Review us", url: "https://g.page/r/abc" }], fetch);
    expect(sent(fetch.calls[0]?.init).reply_markup).toEqual({ inline_keyboard: [[{ text: "Review us", url: "https://g.page/r/abc" }]] });
  });

  it("refuses an empty or oversized message and a non-https button before calling Telegram", async () => {
    const fetch = fakeFetch(200, { ok: true, result: { message_id: 1 } });
    await rejection(sendTelegramMessage(BOT, "42", "  ", [], fetch));
    await rejection(sendTelegramMessage(BOT, "42", "x".repeat(4097), [], fetch));
    await rejection(sendTelegramMessage(BOT, "42", "hi", [{ text: "x", url: "http://g.page" }], fetch));
    expect(fetch.calls).toHaveLength(0);
  });

  it("tells a block apart, and marks rate limits and server errors as worth retrying", async () => {
    const blocked = await rejection(sendTelegramMessage(BOT, "42", "hi", [], fakeFetch(403, { ok: false, description: "Forbidden: bot was blocked by the user" })));
    expect(blocked).toBeInstanceOf(TelegramBlockedError);
    expect(blocked.retryable).toBe(false);
    expect((await rejection(sendTelegramMessage(BOT, "42", "hi", [], fakeFetch(429, { ok: false })))).retryable).toBe(true);
    expect((await rejection(sendTelegramMessage(BOT, "42", "hi", [], fakeFetch(502, {})))).retryable).toBe(true);
    expect((await rejection(sendTelegramMessage(BOT, "42", "hi", [], fakeFetch(400, { ok: false, description: "Bad Request: chat not found" })))).message).toContain("chat not found");
  });

  it("never puts the token in an owner-facing message", async () => {
    const error = await rejection(sendTelegramMessage(BOT, "42", "hi", [], fakeFetch(401, { ok: false })));
    expect(error.message).not.toContain("123:abc");
  });

  it("does not retry an unknown transport failure that could follow provider acceptance", async () => {
    const offline: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await rejection(sendTelegramMessage(BOT, "42", "hi", [], offline));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("may have sent");
    expect(error.message).toContain("Check the conversation");
  });

  it.each(["AbortError", "TimeoutError"])("does not retry a %s after a request may have left", async (name) => {
    const stopped: FetchLike = async () => { throw new DOMException(`Request to ${BOT.token} stopped`, name); };
    const error = await rejection(sendTelegramMessage(BOT, "42", "hi", [], stopped));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("may have sent");
    expect(error.message).not.toContain(BOT.token);
  });

  it("reports an unreadable success response as uncertain without retrying", async () => {
    const unreadable: FetchLike = async () => new Response("interrupted JSON", { status: 200 });
    const error = await rejection(sendTelegramMessage(BOT, "42", "hi", [], unreadable));
    expect(error).toBeInstanceOf(ConnectorError);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("may have sent");
  });

  it.each([null, {}, { message_id: -1 }, { message_id: 1.5 }])("does not retry acceptance without a valid message identity: %j", async (result) => {
    const error = await rejection(sendTelegramMessage(BOT, "42", "hi", [], fakeFetch(200, { ok: true, result })));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("may have sent");
  });
});

describe("deleteTelegramMessage", () => {
  it("deletes by chat and numeric message id", async () => {
    const fetch = fakeFetch(200, { ok: true, result: true });
    await deleteTelegramMessage(BOT, "42", "99", fetch);
    expect(fetch.calls[0]?.url).toBe("https://api.telegram.org/bot123:abc/deleteMessage");
    expect(sent(fetch.calls[0]?.init)).toEqual({ chat_id: "42", message_id: 99 });
  });

  it("does not describe uncertain deletion as a failed send", async () => {
    const interrupted: FetchLike = async () => { throw new DOMException("Stopped", "TimeoutError"); };
    const error = await rejection(deleteTelegramMessage(BOT, "42", "99", interrupted));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("may have removed");
    expect(error.message).not.toContain("may have sent");
  });
});

describe("webhook registration", () => {
  it("points the bot at an https address with the secret and only the updates the app handles", async () => {
    const fetch = fakeFetch(200, { ok: true, result: true });
    await setTelegramWebhook(BOT, "https://anchored.example/api/hooks/telegram", "s3cret_value", fetch);
    expect(fetch.calls[0]?.url).toBe("https://api.telegram.org/bot123:abc/setWebhook");
    expect(sent(fetch.calls[0]?.init)).toEqual({
      url: "https://anchored.example/api/hooks/telegram",
      secret_token: "s3cret_value",
      allowed_updates: ["message", "my_chat_member"],
      drop_pending_updates: true,
    });
  });

  it("refuses a plain http address or a secret Telegram won't accept, before calling it", async () => {
    const fetch = fakeFetch(200, { ok: true, result: true });
    await rejection(setTelegramWebhook(BOT, "http://anchored.example/api/hooks/telegram", "s3cret", fetch));
    await rejection(setTelegramWebhook(BOT, "https://anchored.example/api/hooks/telegram", "has spaces", fetch));
    expect(fetch.calls).toHaveLength(0);
  });

  it("reads where the webhook points and Telegram's last error", async () => {
    const fetch = fakeFetch(200, { ok: true, result: { url: "https://a.example/api/hooks/telegram", pending_update_count: 2, last_error_message: "Wrong response from the webhook: 404 Not Found", allowed_updates: ["message"] } });
    expect(await telegramWebhookInfo(BOT, fetch)).toEqual({ url: "https://a.example/api/hooks/telegram", pendingUpdates: 2, lastError: "Wrong response from the webhook: 404 Not Found", allowedUpdates: ["message"] });
  });
});
