import "server-only";
import { isAuthSessionMissingError, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { isAuthEnabled } from "@/lib/auth/config";
import { createServerSupabase } from "@/lib/auth/server";
import { isSessionId } from "@/lib/auth/session-id";
import type { Viewer } from "@/lib/auth/viewer";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// =============================================================================
// Module Overview
// =============================================================================
// Who is visiting. With accounts on, `findViewer` and `getSessionId` return the
// user that Supabase Auth verified; with accounts off, the anonymous session
// that `middleware.ts` assigns. Every `Store` call is keyed by `getSessionId`.

/** Raised when accounts are on and nobody, not even a guest, is signed in. */
export class SignInRequiredError extends Error {
  override readonly name = "SignInRequiredError";

  constructor() {
    super("Sign in or continue as a guest first.");
  }
}

// =============================================================================
// Reading the visitor
// =============================================================================

/** Return the anonymous session id from its cookie, refusing a missing or malformed value. */
async function readSessionCookie(): Promise<string> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isSessionId(value)) {
    throw new Error(`Session cookie \`${SESSION_COOKIE}\` is missing or not a UUID. Check that \`middleware.ts\` runs for this route.`);
  }
  return value;
}

/** Return the user Supabase Auth verified for this request, or `null` when nobody is signed in. */
async function readVerifiedUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  // `getUser` has Supabase Auth check the token. `getSession` would trust the cookie as the browser sent it.
  const { data, error } = await supabase.auth.getUser();
  if (error && !isAuthSessionMissingError(error)) {
    console.warn(`[Session] Supabase Auth could not verify the session; treating the visitor as signed out. Reason: ${error.message}`);
  }
  return data.user ?? null;
}

// `cache` runs this once per server render: a page reads the session id several times, and each `getUser` is a network call.
/** Return this request's viewer, or `null` when accounts are on and nobody is signed in. */
export const findViewer = cache(async (): Promise<Viewer | null> => {
  if (!isAuthEnabled()) {
    return { id: await readSessionCookie(), email: null, isGuest: true, authEnabled: false };
  }
  const user = await readVerifiedUser();
  if (user === null) return null;
  // A guest's `email` is empty until they confirm the address they added under "Save your work".
  return { id: user.id, email: user.email || null, isGuest: user.is_anonymous === true, authEnabled: true };
});

/** Return this request's viewer. Throws `SignInRequiredError` when accounts are on and nobody is signed in. */
async function getViewer(): Promise<Viewer> {
  const viewer = await findViewer();
  if (viewer === null) throw new SignInRequiredError();
  return viewer;
}

/** Return the id this visitor's data is stored under. */
export async function getSessionId(): Promise<string> {
  return (await getViewer()).id;
}
