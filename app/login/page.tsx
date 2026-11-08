import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isAuthEnabled } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/paths";
import { findViewer } from "@/lib/server/session";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The `/login` page, which is also where new owners sign up. It wears the
// Harbor Chart brand through `.theme-harbor`: the form on the right, and a hull
// navy panel on the left with the brand line and the approve-first promise.
// With accounts on it renders `LoginForm` and sends anyone already signed in
// with an account straight on to `next`. With accounts off, as in local
// development, it says no sign-in is needed and links into the app.

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Return the first value of a query parameter that may repeat. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The promises on the navy panel, each something the app enforces. */
const PROMISES: readonly string[] = [
  "Nothing reaches a customer until you tap Approve.",
  "Texts wait for quiet hours to end.",
  "Your workflows, tool picks and approvals stay with your account.",
];

/** Render the heading shared by both versions of the page. */
function Intro() {
  return (
    <header>
      <p className={styles.eyebrow}>Sign in or sign up</p>
      <h1 className={styles.title}>Welcome aboard</h1>
      <p className={styles.lede}>New here? The same link makes your account. Back again? Pick up where you left off.</p>
    </header>
  );
}

/** Render the hull navy panel: the brand line, the promises and the harbor waves; the header above already names Anchored. */
function Helm() {
  return (
    <aside className={styles.helm} aria-label="What Anchored promises">
      <div className={styles.helmBody}>
        <p className={styles.helmLine}>
          Your crew is ready. <em>You hold the helm.</em>
        </p>
        <ul className={styles.promises}>
          {PROMISES.map((promise) => (
            <li key={promise}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {promise}
            </li>
          ))}
        </ul>
      </div>
      <svg className={styles.waves} viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.waveBack} d="M-40 52c57-18 113-18 170 0s113 18 170 0 113-18 170 0 113 18 170 0V120H-40z" />
        <path className={styles.waveMid} d="M-40 74c57 14 113 14 170 0s113-14 170 0 113 14 170 0 113-14 170 0V120H-40z" />
        <path className={styles.waveFront} d="M0 94c75-12 150-12 225 0s150 12 225 0 100-8 150-4V120H0z" />
      </svg>
    </aside>
  );
}

/** Lay out the sign-in page: the form column, and the navy panel beside it on wide screens. */
function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <div className={`theme-harbor ${styles.page}`}>
      <div className={styles.panel}>
        <div className={styles.column}>
          <Intro />
          {children}
        </div>
      </div>
      <Helm />
    </div>
  );
}

/** Render the page for a build without Supabase settings. */
function AccountsOff({ next }: { readonly next: string }) {
  return (
    <Frame>
      <section className="wo" aria-labelledby="local-title">
        <div className="wo-head">
          <b id="local-title">No sign-in needed</b>
        </div>
        <div className="wo-perf" aria-hidden="true" />
        <div className={styles.slipBody}>
          <p>Accounts are off on this server, so your work stays with this browser.</p>
          <Link className={`btn ${styles.full}`} href={next}>
            Open app
          </Link>
        </div>
      </section>
    </Frame>
  );
}

/** Render the sign-in page, or redirect a visitor who already has an account. */
export default async function LoginPage({ searchParams }: { readonly searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(firstValue(params.next));
  if (!isAuthEnabled()) return <AccountsOff next={next} />;

  const viewer = await findViewer();
  // A guest stays: they may want to sign in to a real account. Anyone with an account has nothing to do here.
  if (viewer !== null && !viewer.isGuest) redirect(next);

  return (
    <Frame>
      <LoginForm next={next} isGuest={viewer?.isGuest === true} linkFailed={firstValue(params.error) !== undefined} />
    </Frame>
  );
}
