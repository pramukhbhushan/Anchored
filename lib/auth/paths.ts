// =============================================================================
// Module Overview
// =============================================================================
// The sign-in routes and the rules around them: `needsSignIn` names the paths
// behind sign-in, `safeNextPath` keeps a `next` redirect on this site, and
// `loginHref` and `callbackUrl` build the links. Pure, so the edge can use it.

/** The sign-in page. */
const LOGIN_PATH = "/login";

/** Where a visitor lands after signing in when no `next` path was given. */
const DEFAULT_NEXT = "/app";

/** The route that finishes a magic-link or Google sign-in. */
const CALLBACK_PATH = "/auth/callback";

/** The route that signs the visitor out. It takes POST only. */
export const SIGN_OUT_PATH = "/auth/signout";

// A reserved `.invalid` host: it only gives a relative path something to resolve against.
const PLACEHOLDER_ORIGIN = "https://anchored.invalid";

/** Report whether `pathname` is part of the app, which needs a signed-in visitor or guest. */
export function needsSignIn(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

/** Return `raw` as a path on this site to redirect to, or `fallback` when it could leave the site. */
export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_NEXT): string {
  // `//host` and `/\host` are absolute URLs to a browser, so a lone leading slash is not enough.
  if (!raw || !raw.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  // The URL parser drops tabs and newlines and reads `\` as `/`, as browsers do, so the origin check sees what a browser would.
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  // Sending someone back to a sign-in step after they sign in would loop.
  if (url.pathname === LOGIN_PATH || url.pathname.startsWith("/auth/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Return the sign-in page's URL, sending the visitor on to `next` afterwards. */
export function loginHref(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

/** Return the absolute callback URL that Supabase redirects to after sign-in, carrying `next`. */
export function callbackUrl(origin: string, next: string): string {
  return `${origin}${CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
}
