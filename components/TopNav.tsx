"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEMO_HREF } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// The main nav in the sticky top bar. It reads the path so `aria-current`
// marks the section you're in: the landing page, the app (any business page or
// onboarding), or the build notes.

/** Render the three main links with the current section marked. */
export function TopNav() {
  const pathname = usePathname();
  const inApp = pathname.startsWith("/b/") || pathname === "/onboard";
  const links = [
    { href: "/", label: "How it works", current: pathname === "/" },
    { href: DEMO_HREF, label: "Try it", current: inApp },
    { href: "/built", label: "How it's built", current: pathname === "/built" },
  ];
  return (
    <nav className="nav" aria-label="Main">
      {links.map((link) => (
        <Link key={link.label} href={link.href} aria-current={link.current ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
