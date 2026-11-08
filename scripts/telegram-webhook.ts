import { ConnectorError } from "@/lib/connectors/errors";
import { setTelegramWebhook, telegramBotFromEnv, telegramWebhookInfo } from "@/lib/connectors/telegram";

// =============================================================================
// Module Overview
// =============================================================================
// Points the shared Telegram bot at a deployed Anchored, or reports where it
// points now. Reads `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and
// `TELEGRAM_WEBHOOK_SECRET` from `.env.local` or the environment, and never
// prints the token or the secret. A bot sends to one address at a time, so
// pointing it at a laptop tunnel takes it away from production until it is
// pointed back.

const USAGE = `Usage:
  node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts set <app-url>
  node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts info

  set <app-url>   Point the bot at <app-url>/api/hooks/telegram, such as https://anchored.vercel.app
  info            Show where the bot points and any error Telegram had reaching it`;

/** Run the command the arguments name, and return the process's exit code. */
async function main(args: readonly string[]): Promise<number> {
  const [command, appUrl] = args;
  const bot = telegramBotFromEnv(process.env);
  if (bot === null) {
    console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME first, in .env.local or the environment.");
    return 1;
  }
  if (command === "set" && appUrl !== undefined) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!secret) {
      console.error("Set TELEGRAM_WEBHOOK_SECRET first. The deployed app must have the same value.");
      return 1;
    }
    const url = `${appUrl.replace(/\/+$/, "")}/api/hooks/telegram`;
    await setTelegramWebhook(bot, url, secret);
    console.log(`@${bot.username} now sends updates to ${url}.`);
    return report(await telegramWebhookInfo(bot));
  }
  if (command === "info") return report(await telegramWebhookInfo(bot));
  console.error(USAGE);
  return 1;
}

/** Print where the webhook points; exit code 1 when Telegram reported trouble reaching it. */
function report(info: Awaited<ReturnType<typeof telegramWebhookInfo>>): number {
  console.log(`Webhook: ${info.url === "" ? "not set" : info.url}`);
  console.log(`Updates waiting: ${info.pendingUpdates}`);
  console.log(`Updates sent: ${info.allowedUpdates.length === 0 ? "all kinds" : info.allowedUpdates.join(", ")}`);
  if (info.lastError === null) return 0;
  console.log(`Telegram's last error: ${info.lastError}`);
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    // A ConnectorError is written for a person; anything else is a bug worth its stack.
    console.error(error instanceof ConnectorError ? error.message : error);
    process.exit(1);
  },
);
