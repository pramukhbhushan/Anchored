import { NextResponse, type NextRequest } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import { loginHref, safeNextPath } from "@/lib/auth/paths";
import { createServerSupabase } from "@/lib/auth/server";

// =============================================================================
// Module Overview
// =============================================================================
// Where Supabase sends the browser after a magic link, Google, or a guest's
// "Save your work" confirmation. `GET` trades the one-time `code` for a session
// cookie, then redirects to `next`, which `safeNextPath` keeps on this site.

/** Finish a sign-in and redirect to `next`, or back to `/login` with an error when the link failed. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const linkFailed = () => redirectTo(`${loginHref(next)}&error=link`);

  if (!isAuthEnabled()) return redirectTo(next);

  // Supabase reports an expired or reused link as `error` and `error_code` on the query.
  const reported = searchParams.get("error_code") ?? searchParams.get("error");
  if (reported !== null) {
    console.warn(`[Auth callback] Supabase refused the link: ${reported}.`);
    return linkFailed();
  }

  const code = searchParams.get("code");
  // An email-change confirmation can arrive with no code: the guest is still signed in, so carry on.
  if (code === null) return redirectTo(next);

  const supabase = await createServerSupabase();
  // The PKCE verifier this needs is a cookie set by the browser that asked for the link, so another browser fails here.
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn(`[Auth callback] Code exchange failed: ${error.code ?? error.message}.`);
    return linkFailed();
  }
  return redirectTo(next);
}
