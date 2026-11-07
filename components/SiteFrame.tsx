"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AnchorMark } from "@/components/AnchorMark";
import { APP_HREF } from "@/components/routes";
import { buttonClass } from "@/components/ui/Button";

// =============================================================================
// Module Overview
// =============================================================================
// The site header and `<main>` for every page outside the app: the landing
// page, "How it's built", sign-in and the 404. Under `/app` it steps aside,
// because the app shell draws its own sidebar, top bar and `<main>`.

/** Render the sticky site header with its nav and the sign-in or open-app button. */
function SiteHeader({ pathname, authEnabled }: { readonly pathname: string; readonly authEnabled: boolean }) {
  const links = [
    { href: "/", label: "How it works", current: pathname === "/" },
    { href: "/#cases", label: "Case studies", current: false },
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
        <Link className={buttonClass("primary", "sm", "top-cta")} href={authEnabled ? "/login" : APP_HREF}>
          {authEnabled ? "Sign in" : "Open Anchored"}
        </Link>
      </div>
    </header>
  );
}

/** Wrap a page in the site header and `<main>`, or pass it through untouched inside `/app`. */
export function SiteFrame({ authEnabled, children }: { readonly authEnabled: boolean; readonly children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === APP_HREF || pathname.startsWith(`${APP_HREF}/`)) return children;
  return (
    <>
      <SiteHeader pathname={pathname} authEnabled={authEnabled} />
      <main id="main">{children}</main>
    </>
  );
}
