import { runDueBriefs } from "@/lib/server/brief";
import { handleError, json } from "@/lib/server/http";
import { sameSecret } from "@/lib/server/secrets";

// =============================================================================
// Module Overview
// =============================================================================
// GET /api/cron/brief writes the morning brief for each business that hasn't
// had one today, from 7 a.m. in the owner's time zone. A scheduler calls it
// hourly with `Authorization: Bearer <CRON_SECRET>`; without that secret set,
// the route refuses every call. Calling it again the same day writes nothing.

export const dynamic = "force-dynamic";

/** Write the briefs that are due and report how many. */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    const given = request.headers.get("authorization") ?? "";
    if (!secret || !sameSecret(given, `Bearer ${secret}`)) return new Response("Not found", { status: 404 });
    return json({ ok: true, ...(await runDueBriefs(new Date())) });
  } catch (error) {
    return handleError(error, "GET /api/cron/brief");
  }
}
