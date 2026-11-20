import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ConnectorError, PROVIDER_TIMEOUT_MS, type FetchLike } from "./errors";

// =============================================================================
// Module Overview
// =============================================================================
// The one shared Anchored bot on Telegram. `readTelegramUpdate` turns a webhook
// update into one plain value: a /start with the business's hook id, a /stop, a
// customer's text, or the customer blocking or unblocking the bot. Anything
// else is `ignored`. `verifyTelegramSecret` checks the secret header Telegram
// sends on every webhook call. `sendTelegramMessage` sends plain text, never
// Markdown or HTML, with optional link buttons; `deleteTelegramMessage` takes
// one back. `telegramLink` builds the link a business shows its customers.
// `setTelegramWebhook` and `telegramWebhookInfo` register and check where the
// bot sends updates, for `scripts/telegram-webhook.ts`.

/** The bot's token and username, both from server settings. */
export interface TelegramBot {
  readonly token: string;
  readonly username: string;
}

/** One webhook update, read into what Anchored does with it. */
export type TelegramUpdate =
  | { readonly kind: "start"; readonly updateId: number; readonly chatId: string; readonly name: string | null; readonly hookId: string | null }
  | { readonly kind: "stop"; readonly updateId: number; readonly chatId: string; readonly name: string | null }
  | { readonly kind: "text"; readonly updateId: number; readonly chatId: string; readonly name: string | null; readonly text: string }
  | { readonly kind: "blocked" | "unblocked"; readonly updateId: number; readonly chatId: string }
  | { readonly kind: "ignored"; readonly updateId: number };

/** A link button under a message. Only https links to hosts the caller allows ever become buttons. */
export interface TelegramButton {
  readonly text: string;
  readonly url: string;
}

const API = "https://api.telegram.org";

/** The longest text one Telegram message carries. */
export const TELEGRAM_TEXT_MAX = 4096;

// Telegram's documented limits: a start parameter is 1 to 64 of these characters, and a bot username 5 to 32.
const START_PARAM = /^[A-Za-z0-9_-]{1,64}$/;
const BOT_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** The secret header Telegram sends with each webhook call when the webhook was registered with `secret_token`. */
export const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

// =============================================================================
// Webhook updates
// =============================================================================

/** Whether `header` matches the webhook secret. A missing header or secret never matches. */
export function verifyTelegramSecret(secret: string | undefined, header: string | null): boolean {
  if (!secret || header === null) return false;
  const expected = Buffer.from(secret);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Only private chats are customers; a group or channel that adds the bot is ignored.
const chat = z.object({ id: z.number().int(), type: z.string() });
const user = z.object({ first_name: z.string().optional(), last_name: z.string().optional(), username: z.string().optional() });
const UPDATE = z.object({
  update_id: z.number().int().nonnegative(),
  message: z.object({ chat, from: user.optional(), text: z.string().optional() }).optional(),
  my_chat_member: z.object({ chat, new_chat_member: z.object({ status: z.string() }) }).optional(),
});

/** The name a customer shows on Telegram, cut to 80 characters, or `null` when they show none. */
function displayName(from: z.infer<typeof user> | undefined): string | null {
  const full = [from?.first_name, from?.last_name].filter((part) => part !== undefined && part.trim() !== "").join(" ").trim();
  const name = full === "" ? (from?.username ?? "") : full;
  return name === "" ? null : name.slice(0, 80);
}

/** The command a message starts with, such as "start" for "/start abc" or "/start@AnchoredBot abc", and its argument. */
function command(text: string): { readonly name: string; readonly argument: string } | null {
  const match = /^\/([A-Za-z]+)(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?\s*$/.exec(text.trim());
  if (match === null) return null;
  return { name: (match[1] ?? "").toLowerCase(), argument: match[2] ?? "" };
}

/** Read one webhook update. Throws `ConnectorError` when the body isn't an update at all. */
export function readTelegramUpdate(body: unknown): TelegramUpdate {
  const parsed = UPDATE.safeParse(body);
  if (!parsed.success) throw new ConnectorError("This isn't a Telegram update.", false);
  const update = parsed.data;
  const updateId = update.update_id;

  const member = update.my_chat_member;
  if (member !== undefined) {
    if (member.chat.type !== "private") return { kind: "ignored", updateId };
    const status = member.new_chat_member.status;
    // "kicked" is how Telegram reports that a private chat blocked the bot; "member" that it unblocked it.
    if (status === "kicked") return { kind: "blocked", updateId, chatId: String(member.chat.id) };
    if (status === "member") return { kind: "unblocked", updateId, chatId: String(member.chat.id) };
    return { kind: "ignored", updateId };
  }

  const message = update.message;
  if (message === undefined || message.chat.type !== "private" || message.text === undefined) return { kind: "ignored", updateId };
  const chatId = String(message.chat.id);
  const name = displayName(message.from);
  const asked = command(message.text);
  if (asked?.name === "start") return { kind: "start", updateId, chatId, name, hookId: START_PARAM.test(asked.argument) ? asked.argument : null };
  if (asked?.name === "stop") return { kind: "stop", updateId, chatId, name };
  const text = message.text.trim();
  if (text === "") return { kind: "ignored", updateId };
  return { kind: "text", updateId, chatId, name, text: text.slice(0, TELEGRAM_TEXT_MAX) };
}

// =============================================================================
// Sending
// =============================================================================

/** Read the bot's settings from the environment, or `null` when either is missing or malformed. */
export function telegramBotFromEnv(env: Readonly<Record<string, string | undefined>>): TelegramBot | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const username = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (!token || !username || !BOT_USERNAME.test(username)) return null;
  return { token, username };
}

/** The link a customer opens to message one business through the shared bot, or `null` for a malformed hook id. */
export function telegramLink(username: string, hookId: string): string | null {
  if (!BOT_USERNAME.test(username) || !START_PARAM.test(hookId)) return null;
  return `https://t.me/${username}?start=${hookId}`;
}

/** Whether `url` may become a button: an https link to one of `hosts`, with no user name or password in it. */
export function isSafeButtonUrl(url: string, hosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" && hosts.includes(parsed.hostname.toLowerCase());
}

/** Turn a failed Bot API response into an error the owner can act on. */
async function telegramFailure(response: Response): Promise<ConnectorError> {
  let detail: { description?: string } = {};
  try {
    detail = (await response.json()) as typeof detail;
  } catch {
    // Some failures carry no JSON body; the status alone tells us enough.
  }
  if (response.status === 403) return new TelegramBlockedError();
  if (response.status === 429) return new ConnectorError("Telegram asked Anchored to slow down. It will try again shortly.", true);
  if (response.status === 401 || response.status === 404) return new ConnectorError("Telegram refused the bot's token. Check the Telegram settings on the server.", false);
  return new ConnectorError(`Telegram didn't send it (${detail.description ?? `HTTP ${response.status}`}).`, response.status >= 500);
}

/** Telegram refused because the customer blocked the bot or never started a chat with it. */
export class TelegramBlockedError extends ConnectorError {
  constructor() {
    super("This customer blocked the bot on Telegram, so Anchored can't message them.", false);
  }
}

/** Explain an unknown provider outcome without promising a safe retry. */
function uncertainResponse(method: string): ConnectorError {
  if (method === "sendMessage") return new ConnectorError("Telegram may have sent this message. Check the conversation before sending again.", false);
  if (method === "deleteMessage") return new ConnectorError("Telegram may have removed this message. Check the conversation before trying again.", false);
  return new ConnectorError("Anchored couldn't confirm Telegram's response. Check the Telegram setup before trying again.", false);
}

/** Call one Bot API method, preserving an uncertain outcome when transport or response reading fails. */
async function call(bot: TelegramBot, method: string, payload: Readonly<Record<string, unknown>>, fetchImpl: FetchLike): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${API}/bot${bot.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    // A lost response, an abort and a connection reset can all follow a successful remote send.
    throw uncertainResponse(method);
  }
  if (!response.ok) throw await telegramFailure(response);
  let answer: { ok?: boolean; result?: unknown } | null;
  try {
    answer = (await response.json()) as typeof answer;
  } catch {
    throw uncertainResponse(method);
  }
  if (answer === null || typeof answer !== "object") throw uncertainResponse(method);
  if (answer.ok !== true) throw new ConnectorError("Telegram answered without confirming it.", false);
  return answer.result;
}

/**
 * Send `text` to a chat as plain text, with any `buttons` as link buttons under it. Returns Telegram's message id.
 * Buttons must already be checked with `isSafeButtonUrl`; this throws rather than send one that isn't https.
 */
export async function sendTelegramMessage(
  bot: TelegramBot,
  chatId: string,
  text: string,
  buttons: readonly TelegramButton[] = [],
  fetchImpl: FetchLike = fetch,
): Promise<{ readonly id: string }> {
  if (text.trim() === "" || text.length > TELEGRAM_TEXT_MAX) throw new ConnectorError(`A Telegram message must be 1 to ${TELEGRAM_TEXT_MAX} characters.`, false);
  if (buttons.some((button) => !button.url.startsWith("https://"))) throw new ConnectorError("A Telegram button must link to an https address.", false);
  const payload = {
    chat_id: chatId,
    text,
    // No `parse_mode`: the text goes out exactly as written, so a stray * or < can't change it.
    link_preview_options: { is_disabled: true },
    ...(buttons.length > 0 ? { reply_markup: { inline_keyboard: buttons.map((button) => [{ text: button.text.slice(0, 64), url: button.url }]) } } : {}),
  };
  const result = (await call(bot, "sendMessage", payload, fetchImpl)) as { message_id?: unknown } | undefined;
  if (typeof result?.message_id !== "number" || !Number.isSafeInteger(result.message_id) || result.message_id <= 0) throw uncertainResponse("sendMessage");
  return { id: String(result.message_id) };
}

/** Delete a message the bot sent. Telegram allows it for 48 hours after sending. */
export async function deleteTelegramMessage(bot: TelegramBot, chatId: string, messageId: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const result = await call(bot, "deleteMessage", { chat_id: chatId, message_id: Number(messageId) }, fetchImpl);
  if (result !== true) throw uncertainResponse("deleteMessage");
}

// =============================================================================
// Webhook registration
// =============================================================================

/** What Telegram reports about the bot's webhook. */
export interface TelegramWebhookInfo {
  readonly url: string;
  readonly pendingUpdates: number;
  readonly lastError: string | null;
  readonly allowedUpdates: readonly string[];
}

/** The update kinds the webhook handles: messages, and a customer blocking or unblocking the bot. */
export const TELEGRAM_ALLOWED_UPDATES = ["message", "my_chat_member"] as const;

/** Point the bot's webhook at `url`, with `secret` sent on every call, dropping updates that queued up meanwhile. */
export async function setTelegramWebhook(bot: TelegramBot, url: string, secret: string, fetchImpl: FetchLike = fetch): Promise<void> {
  if (!url.startsWith("https://")) throw new ConnectorError("Telegram only sends to an https address.", false);
  // Telegram allows 1 to 256 of these characters in the secret.
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new ConnectorError("The webhook secret must be 1 to 256 letters, digits, _ or -.", false);
  await call(bot, "setWebhook", { url, secret_token: secret, allowed_updates: TELEGRAM_ALLOWED_UPDATES, drop_pending_updates: true }, fetchImpl);
}

/** Read where the bot's webhook points and whether Telegram had trouble reaching it. */
export async function telegramWebhookInfo(bot: TelegramBot, fetchImpl: FetchLike = fetch): Promise<TelegramWebhookInfo> {
  const info = (await call(bot, "getWebhookInfo", {}, fetchImpl)) as { url?: string; pending_update_count?: number; last_error_message?: string; allowed_updates?: string[] } | undefined;
  return { url: info?.url ?? "", pendingUpdates: info?.pending_update_count ?? 0, lastError: info?.last_error_message ?? null, allowedUpdates: info?.allowed_updates ?? [] };
}
