import { NextResponse, type NextRequest } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import { createServerSupabase } from "@/lib/auth/server";
import { isAllowedOrigin } from "@/lib/server/origin";

// =============================================================================
// Module Overview
// =============================================================================
// Signs the visitor out. `POST` only, so a link or a prefetch can't sign anyone
// out, and it refuses a post from another site. It ends this device's Supabase
// session, then sends the browser to the landing page.

/** Sign out of this device's session and redirect to `/`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // `middleware.ts` checks `Origin` only under `/api/`, so this route repeats that check itself.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (!isAllowedOrigin(request.headers.get("origin"), host)) {
    return NextResponse.json({ error: "This request came from another site. Open Anchored itself and try again." }, { status: 403 });
  }

  if (isAuthEnabled()) {
    const supabase = await createServerSupabase();
    // `local` ends only this browser's session; the default would sign the account out on every device.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.warn(`[Auth signout] Supabase could not end the session; sending the visitor home anyway. Reason: ${error.message}`);
  }
  // 303 makes the browser follow with a GET, not repeat the POST.
  return NextResponse.redirect(new URL("/", request.url), 303);
}
