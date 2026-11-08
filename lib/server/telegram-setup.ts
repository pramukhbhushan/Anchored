import "server-only";
import type { TelegramSetupResponse } from "@/lib/api/contract";
import { telegramBotFromEnv, telegramLink } from "@/lib/connectors/telegram";
import type { BusinessProfile } from "@/lib/domain/types";
import { newHookId } from "@/lib/server/secrets";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// The Telegram link a business shows its customers: `t.me/<bot>?start=<hook>`,
// where the hook id is the business's own random id, made the first time the
// link is asked for. Guests get a link for their own business, since judges
// test with one. The shared example business never gets one: everyone sees
// it, so a live inbox there would mix strangers' messages.

/** Return the business's Telegram test link, or why it has none. */
export async function telegramSetup(session: string, business: BusinessProfile, env: Readonly<Record<string, string | undefined>> = process.env): Promise<TelegramSetupResponse> {
  if (business.kind === "case") return unavailable("This is the shared example, so it has no Telegram link. Create your own business to get one.");
  const bot = telegramBotFromEnv(env);
  if (bot === null) return unavailable("Telegram isn't set up on this server yet, so there's no link to share.");
  const hookId = await getStore().telegramHook(session, business.id, newHookId());
  const url = telegramLink(bot.username, hookId);
  return url === null ? unavailable("This business's Telegram link couldn't be made. Try again later.") : { url, unavailableReason: null };
}

function unavailable(reason: string): TelegramSetupResponse {
  return { url: null, unavailableReason: reason };
}
