import { ConnectorError } from "@/lib/connectors/errors";
import { readTelegramUpdate, TELEGRAM_SECRET_HEADER, verifyTelegramSecret } from "@/lib/connectors/telegram";
import { handleError, json } from "@/lib/server/http";
import { receiveTelegramUpdate } from "@/lib/server/telegram-hooks";

// =============================================================================
// Module Overview
// =============================================================================
// The shared Telegram bot's webhook. Telegram sends `TELEGRAM_WEBHOOK_SECRET`
// in a header on every call; anything without it gets a 404 before any data is
// read. Each update is claimed by its id so a retry runs it once, handled while
// the request waits, and answered 200 only once its work is saved. A failure
// answers 500, which makes Telegram retry, and the failed claim can be taken
// again. Nothing here sends a message by itself.

/** Receive one update from Telegram. */
export async function POST(request: Request) {
  if (!verifyTelegramSecret(process.env.TELEGRAM_WEBHOOK_SECRET?.trim(), request.headers.get(TELEGRAM_SECRET_HEADER))) {
    return new Response("Not found", { status: 404 });
  }
  let update;
  try {
    update = readTelegramUpdate(await request.json());
  } catch (error) {
    if (error instanceof ConnectorError || error instanceof SyntaxError) return json({ error: "This isn't a Telegram update." }, 400);
    return handleError(error, "POST /api/hooks/telegram");
  }
  try {
    const receipt = await receiveTelegramUpdate(update, new Date());
    if (receipt.status === "duplicate") return json({ received: true, duplicate: true });
    if (receipt.status === "busy") return json({ error: "This update is still being processed. Retry shortly." }, 503);
    return json({ received: true, outcome: receipt.outcome });
  } catch (error) {
    return handleError(error, "POST /api/hooks/telegram");
  }
}
