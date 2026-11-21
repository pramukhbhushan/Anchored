"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account/AccountMenu";
import { AnchorMark } from "@/components/ui/AnchorMark";
import { LandingHeader } from "@/components/site/harbor/LandingHeader";
import { APP_HREF } from "@/components/routes";
import { buttonClass } from "@/components/ui/Button";
import type { Viewer } from "@/lib/auth/viewer";

// =============================================================================
// Module Overview
// =============================================================================
// The site header and `<main>` for every page outside the app: the landing
// page, "How it's built", sign-in and the 404. The header says "Sign in" to a
// signed-out visitor and "Open app" with the account menu once signed in.
// The landing page gets its own header, `LandingHeader`, with the theme
// toggle. Under `/app` it steps aside, because the app shell draws its own chrome.

/** Props for `SiteFrame`; `viewer` is `null` when nobody is signed in or accounts are off. */
interface SiteFrameProps {
  readonly authEnabled: boolean;
  readonly viewer: Viewer | null;
  readonly children: ReactNode;
}

/** Render the sticky site header with its nav, and "Sign in" or "Open app" with the account menu. */
function SiteHeader({ pathname, authEnabled, viewer }: { readonly pathname: string; readonly authEnabled: boolean; readonly viewer: Viewer | null }) {
  // With accounts off nobody signs in, so the app is always one click away.
  const signedOut = authEnabled && viewer === null;
  const links = [
    { href: "/", label: "How it works", current: pathname === "/" },
    { href: "/app/b/restaurant", label: "Example", current: false },
    { href: "/built", label: "How it's built", current: pathname === "/built" },
  ];
  return (
    <header className="top">
      <div className="wrap">
        <Link className="mark" href="/" aria-label="Anchored home">
          <AnchorMark />
          Anchored
        </Link>
        <nav className="nav" aria-label="Main">
          {links.map((link) => (
            <Link key={link.label} href={link.href} aria-current={link.current ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="top-end">
          <Link className={buttonClass("primary", "sm", "top-cta")} href={signedOut ? "/login" : APP_HREF}>
            {signedOut ? "Sign in" : "Open app"}
          </Link>
          {viewer !== null && viewer.authEnabled && <AccountMenu viewer={viewer} />}
        </div>
      </div>
    </header>
  );
}

/** Wrap a page in the site header and `<main>`, or pass it through untouched inside `/app`. */
export function SiteFrame({ authEnabled, viewer, children }: SiteFrameProps) {
  const pathname = usePathname();
  if (pathname === APP_HREF || pathname.startsWith(`${APP_HREF}/`)) return children;
  return (
    <>
      {pathname === "/" ? <LandingHeader authEnabled={authEnabled} viewer={viewer} /> : <SiteHeader pathname={pathname} authEnabled={authEnabled} viewer={viewer} />}
      <main id="main">{children}</main>
    </>
  );
}
