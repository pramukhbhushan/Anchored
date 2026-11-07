import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

// =============================================================================
// Module Overview
// =============================================================================
// Turns a Supabase Auth failure into one sentence the visitor can act on.
// `authErrorText` reads the error's `code`, so the sign-in page and the account
// menu say the same thing for the same problem.

const NETWORK = "Couldn't reach the sign-in service. Check your connection and try again.";
const FALLBACK = "Sign-in didn't work. Try again in a moment.";

// Codes from `@supabase/auth-js` `ErrorCode`; anything unlisted gets `FALLBACK`.
const BY_CODE: Readonly<Record<string, string>> = {
  over_email_send_rate_limit: "Too many emails went to this address. Wait a few minutes, then try again.",
  over_request_rate_limit: "Too many sign-in attempts. Wait a few minutes, then try again.",
  email_address_invalid: "That email address doesn't look right. Check it and try again.",
  validation_failed: "That email address doesn't look right. Check it and try again.",
  email_exists: "That email already has an Anchored account. Sign out, then sign in with it.",
  user_already_exists: "That email already has an Anchored account. Sign out, then sign in with it.",
  anonymous_provider_disabled: "Guest access is off for this site. Sign in with email or Google instead.",
  email_provider_disabled: "Email sign-in is off for this site. Use Google or continue as a guest.",
  otp_disabled: "Email sign-in is off for this site. Use Google or continue as a guest.",
  signup_disabled: "New accounts are closed on this site. Continue as a guest instead.",
  provider_disabled: "Google sign-in is off for this site. Use email or continue as a guest.",
  oauth_provider_not_supported: "Google sign-in is off for this site. Use email or continue as a guest.",
  captcha_failed: "The sign-in check failed. Reload the page and try again.",
};

/** Return a plain-words message for a failed Supabase Auth call. */
export function authErrorText(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return NETWORK;
  // `fetch` rejects with a `TypeError` when the browser can't reach the server at all.
  if (error instanceof TypeError) return NETWORK;
  if (!isAuthError(error) || error.code === undefined) return FALLBACK;
  return BY_CODE[error.code] ?? FALLBACK;
}
