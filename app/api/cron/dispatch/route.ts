import { handleError, json } from "@/lib/server/http";
import { dispatchDue } from "@/lib/server/dispatch";
import { sameSecret } from "@/lib/server/secrets";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// GET /api/cron/dispatch sends every queued message that is due, such as a text
// held overnight for quiet hours. A scheduler calls it every few minutes with
// `Authorization: Bearer <CRON_SECRET>`, which is how Vercel Cron calls a route.
// Without `CRON_SECRET` set, the route refuses every call.

export const dynamic = "force-dynamic";

/** Send what is due and report how each send went. */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    const given = request.headers.get("authorization") ?? "";
    if (!secret || !sameSecret(given, `Bearer ${secret}`)) return new Response("Not found", { status: 404 });
    return json({ ok: true, ...(await dispatchDue(getStore(), new Date())) });
  } catch (error) {
    return handleError(error, "GET /api/cron/dispatch");
  }
}
