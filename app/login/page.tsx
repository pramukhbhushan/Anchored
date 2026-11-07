import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthEnabled } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/paths";
import { findViewer } from "@/lib/server/session";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The `/login` page. With accounts on it renders `LoginForm` and sends anyone
// already signed in with an account straight on to `next`. With accounts off it
// says the demo runs without accounts and links into the app.

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Return the first value of a query parameter that may repeat. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Render the heading shared by both versions of the page. */
function Intro() {
  return (
    <header>
      <h1 className={styles.title}>Sign in to Anchored</h1>
      <p className={styles.lede}>Pick up your workflows, tool picks and approvals where you left them.</p>
    </header>
  );
}

/** Render the page for a build without Supabase settings. */
function LocalDemo({ next }: { readonly next: string }) {
  return (
    <div className={styles.page}>
      <Intro />
      <section className="wo" aria-labelledby="local-title">
        <div className="wo-head">
          <b id="local-title">Local demo</b>
          <span>No accounts</span>
        </div>
        <div className="wo-perf" aria-hidden="true" />
        <div className={styles.slipBody}>
          <p>This demo runs without accounts, so your work stays with this browser.</p>
          <Link className={`btn ${styles.full}`} href={next}>
            Open Anchored
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Render the sign-in page, or redirect a visitor who already has an account. */
export default async function LoginPage({ searchParams }: { readonly searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(firstValue(params.next));
  if (!isAuthEnabled()) return <LocalDemo next={next} />;

  const viewer = await findViewer();
  // A guest stays: they may want to sign in to a real account. Anyone with an account has nothing to do here.
  if (viewer !== null && !viewer.isGuest) redirect(next);

  return (
    <div className={styles.page}>
      <Intro />
      <LoginForm next={next} isGuest={viewer?.isGuest === true} linkFailed={firstValue(params.error) !== undefined} />
    </div>
  );
}
