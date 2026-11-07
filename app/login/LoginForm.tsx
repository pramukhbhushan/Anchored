"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/auth/browser";
import { authErrorText } from "@/lib/auth/errors";
import { callbackUrl } from "@/lib/auth/paths";
import styles from "./login.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The interactive half of `/login`: an emailed magic link, Google, and
// Continue as guest. `FormState` tracks one attempt at a time, and each failure
// shows in plain words next to the option that failed.

/** One way to sign in. */
type Method = "email" | "google" | "guest";

/** Where the form is: waiting for input, running one method, showing one failure, or done sending a link. */
type FormState =
  | { readonly step: "ready" }
  | { readonly step: "working"; readonly method: Method }
  | { readonly step: "failed"; readonly method: Method; readonly message: string }
  | { readonly step: "sent"; readonly email: string };

const READY: FormState = { step: "ready" };
const LINK_FAILED = "That sign-in link didn't work. It may have expired or been used already. Send yourself a new one.";

/** Props for `LoginForm`. */
export interface LoginFormProps {
  /** Same-site path to open after signing in, already checked by `safeNextPath`. */
  readonly next: string;
  /** True when the visitor already holds a guest session. */
  readonly isGuest: boolean;
  /** True when `/auth/callback` sent the visitor back because a link failed. */
  readonly linkFailed: boolean;
}

/** The Google "G", drawn in Google's own colors as its sign-in guidelines ask. */
function GoogleMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Render the sign-in slip and the guest option, and run whichever the visitor picks. */
export function LoginForm({ next, isGuest, linkFailed }: LoginFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(linkFailed ? { step: "failed", method: "email", message: LINK_FAILED } : READY);
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(state.step);

  const working = state.step === "working";
  const isWorking = (method: Method): boolean => state.step === "working" && state.method === method;
  const failureFor = (methods: readonly Method[]): string | null =>
    state.step === "failed" && methods.includes(state.method) ? state.message : null;

  // Coming back from Google with the Back button restores this page mid-attempt; start over instead.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setState(READY);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Move focus with the content, so keyboard and screen-reader users land on what just appeared.
  useEffect(() => {
    if (state.step === "sent") sentRef.current?.focus();
    else if (previousStep.current === "sent") emailRef.current?.focus();
    previousStep.current = state.step;
  }, [state.step]);

  /** Run one sign-in call, and return whether it succeeded; on failure, show why. */
  async function attempt(method: Method, call: () => Promise<{ readonly error: unknown }>): Promise<boolean> {
    setState({ step: "working", method });
    try {
      const { error } = await call();
      if (!error) return true;
      setState({ step: "failed", method, message: authErrorText(error) });
    } catch (error) {
      // `createBrowserSupabase` throws when the public keys were missing at build time, and `fetch` throws offline.
      setState({ step: "failed", method, message: authErrorText(error) });
    }
    return false;
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    const sent = await attempt("email", () =>
      createBrowserSupabase().auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: callbackUrl(window.location.origin, next) },
      }),
    );
    if (sent) setState({ step: "sent", email: address });
  }

  async function continueWithGoogle() {
    // On success the browser is already leaving for Google, so the button stays in its working state.
    await attempt("google", () =>
      createBrowserSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(window.location.origin, next) },
      }),
    );
  }

  async function continueAsGuest() {
    // A second anonymous sign-in would make a new user and strand the current guest's work.
    const signedIn = isGuest || (await attempt("guest", () => createBrowserSupabase().auth.signInAnonymously()));
    if (!signedIn) return;
    setState({ step: "working", method: "guest" });
    router.replace(next);
  }

  const slipError = failureFor(["email", "google"]);
  const guestError = failureFor(["guest"]);

  return (
    <>
      <section className="wo" aria-labelledby="signin-title">
        <div className="wo-head">
          <b id="signin-title">Sign in</b>
          <span>No password needed</span>
        </div>
        <div className="wo-perf" aria-hidden="true" />
        <div className={styles.slipBody}>
          {isGuest && (
            <p className={styles.note}>
              You&apos;re exploring as a guest. Signing in here switches accounts and leaves this guest work behind. To keep it, choose
              Save your work in the account menu instead.
            </p>
          )}

          {state.step === "sent" ? (
            <div ref={sentRef} tabIndex={-1} className={styles.sent} role="status">
              <span className="stamp turnon fresh">Link sent</span>
              <p>
                <strong>Check your email for a sign-in link.</strong>
              </p>
              <p className={styles.fine}>
                We sent it to {state.email}. Open it in this browser to finish signing in.
              </p>
              <button type="button" className="linkbtn" onClick={() => setState(READY)}>
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form className={styles.form} onSubmit={sendLink} aria-busy={isWorking("email")}>
                <label htmlFor="login-email" className={styles.label}>
                  Email
                </label>
                <input
                  id="login-email"
                  ref={emailRef}
                  className={styles.input}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@yourbusiness.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  // Read-only rather than disabled, so focus stays in the field while a method runs
                  readOnly={working}
                />
                <button type="submit" className={`btn ${styles.full}`} disabled={working}>
                  {isWorking("email") ? "Sending link..." : "Email me a sign-in link"}
                </button>
              </form>
              <p className={styles.or}>or</p>
              <button type="button" className={`btn ghost ${styles.full}`} onClick={continueWithGoogle} disabled={working}>
                <GoogleMark />
                {isWorking("google") ? "Opening Google..." : "Continue with Google"}
              </button>
              {slipError && (
                <p role="alert" className={styles.error}>
                  {slipError}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className={styles.guest} aria-labelledby="guest-title">
        <h2 id="guest-title" className={styles.guestTitle}>
          Just looking?
        </h2>
        <p>Try Anchored as a guest, with no account. Add your email later from the account menu to keep your work.</p>
        <button type="button" className="btn ghost" onClick={continueAsGuest} disabled={working}>
          {isWorking("guest") ? "Opening Anchored..." : "Continue as guest"}
        </button>
        {guestError && (
          <p role="alert" className={styles.error}>
            {guestError}
          </p>
        )}
      </section>
    </>
  );
}
