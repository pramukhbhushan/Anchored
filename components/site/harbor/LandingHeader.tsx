"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/account/AccountMenu";
import { APP_HREF, NEW_BUSINESS_HREF } from "@/components/routes";
import styles from "@/components/site/harbor/harbor.module.css";
import type { Viewer } from "@/lib/auth/viewer";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's header: links to How it works, What it covers, Pricing
// and Questions, a light and dark toggle, Log in
// and Get started. Get started opens chat onboarding at `/app/new`; with
// accounts on, the middleware sends signed-out visitors to sign in first.
// The toggle sets `data-theme` on <html> and remembers it in localStorage
// under `THEME_KEY`; the root layout applies it before the first paint.

export const THEME_KEY = "anchored-theme";

type Mode = "light" | "dark";

/** Return the mode the page shows now: the saved choice, or the system's. */
function currentMode(): Mode {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Render the round button that flips light and dark. */
function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");
  useEffect(() => {
    setMode(currentMode());
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setMode(currentMode());
    dark.addEventListener("change", sync);
    return () => dark.removeEventListener("change", sync);
  }, []);
  const flip = () => {
    const next: Mode = currentMode() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the choice then lasts until the page reloads.
    }
    setMode(next);
  };
  return (
    <button type="button" className={styles.theme} onClick={flip} aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      {mode === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}

/** Render the sticky header. A signed-in visitor gets "Open app" and the account menu instead of Log in; with accounts off, "Open app" alone. */
export function LandingHeader({ authEnabled, viewer }: { readonly authEnabled: boolean; readonly viewer: Viewer | null }) {
  const signedIn = viewer !== null && viewer.authEnabled;
  // With accounts off nobody signs in, so the app is one click away instead.
  const showApp = signedIn || !authEnabled;
  return (
    <header className={`${styles.harbor} ${styles.head} ${styles.pad}`}>
      <div className={`${styles.inner} ${styles.headIn}`}>
        <Link className={styles.word} href="/">
          Anchored
        </Link>
        <nav className={styles.links} aria-label="Sections">
          <a href="#how-it-works">How it works</a>
          <a href="#agents">What it covers</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">Questions</a>
        </nav>
        <div className={styles.act}>
          <ThemeToggle />
          {showApp ? (
            <Link className={`${styles.btn} ${styles.text}`} href={APP_HREF}>
              Open app
            </Link>
          ) : (
            <Link className={`${styles.btn} ${styles.text}`} href="/login">
              Log in
            </Link>
          )}
          <Link className={`${styles.btn} ${styles.primary}`} href={NEW_BUSINESS_HREF}>
            Get started
          </Link>
          {signedIn && <AccountMenu viewer={viewer} />}
        </div>
      </div>
    </header>
  );
}
