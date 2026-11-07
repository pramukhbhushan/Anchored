"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnchorMark } from "@/components/AnchorMark";
import { ResizeHandle } from "@/components/resize/ResizeHandle";
import { useResizableWidth, widthVar } from "@/components/resize/use-resizable-width";
import { APP_HREF, businessHref } from "@/components/routes";
import { BusinessSwitcher } from "@/components/shell/BusinessSwitcher";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { useShellLocation, type ShellLocation } from "@/components/shell/location";
import { SHORTCUT_SECTION, SIDEBAR_COOKIE } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/Sidebar";
import type { BusinessSummary } from "@/components/shell/shell-data";

// =============================================================================
// Module Overview
// =============================================================================
// The frame around every page under `/app`: sidebar, top bar and the page,
// plus the command palette and keyboard shortcuts (Cmd or Ctrl+K, `g` then
// o, w, t or a, and `/` for the chat box). Below `WIDE_QUERY` the sidebar is a
// drawer; above it, it drags from 200 to 420px (saved by `useResizableWidth`)
// and collapses to a 64px icon rail, remembered in a cookie for the server.

// Matches the `960px` breakpoint in `globals.css` where the sidebar stops being a drawer.
const WIDE_QUERY = "(min-width: 960px)";

// The icon rail's width; the collapse toggle switches to it, and dragging changes only the open width.
const COLLAPSED_SIDE_W = 64;

// How long after `g` the second key of a shortcut still counts.
const CHORD_MS = 1200;

// Every chat box the `/` shortcut can focus: onboarding, the business chat and the one on the profile page.
const CHAT_INPUT = ".chat-stage textarea, .prof-chat textarea";

/** Report whether a key press is going into a text field, where shortcuts must not fire. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/** Return the shortcut modifier's name on this device: the Command symbol on Apple keyboards, else "Ctrl". */
function useModKey(): string {
  return useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"),
    // The server can't know the keyboard; "Ctrl" until the browser says otherwise.
    () => "Ctrl",
  );
}

/** Return what the top bar names at phone width: the open business, or the page. */
function titleOf(location: ShellLocation, current: BusinessSummary | undefined): string {
  if (current !== undefined) return current.kind === "case" ? `${current.name} (sample)` : current.name;
  return location.page === "new" ? "New business" : "All businesses";
}

/** Render the shell around `children`; `demo` and `account` are server-rendered slots for the top bar. */
export function AppShell({
  businesses,
  initiallyCollapsed,
  demo,
  account,
  children,
}: {
  readonly businesses: readonly BusinessSummary[];
  readonly initiallyCollapsed: boolean;
  readonly demo: ReactNode;
  readonly account: ReactNode;
  readonly children: ReactNode;
}) {
  const location = useShellLocation();
  const pathname = usePathname();
  const router = useRouter();
  const modKey = useModKey();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The hook owns the width only; the cookie owns collapsed, so the server already renders the icon rail.
  const sidebar = useResizableWidth({ storageKey: "sidebar", side: "right", defaultWidth: 256, min: 200, max: 420 });
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const current = location.page === "business" ? businesses.find((b) => b.id === location.businessId) : undefined;

  const close = useCallback(() => {
    setOpen(false);
    menuButton.current?.focus();
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  // A tapped link should land on its page, not leave the drawer covering it.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const wide = window.matchMedia(WIDE_QUERY);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Widening the window mid-drawer would otherwise leave the page inert behind a sidebar that is no longer a drawer.
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open, close]);

  useEffect(() => {
    // Time of the last bare `g`, or 0 when no shortcut is under way.
    let chordStart = 0;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || paletteOpen) return;
      if (event.key === "/") {
        const input = document.querySelector<HTMLTextAreaElement>(CHAT_INPUT);
        if (input === null) return;
        event.preventDefault();
        input.focus();
        return;
      }
      const inChord = chordStart > 0 && event.timeStamp - chordStart < CHORD_MS;
      chordStart = event.key === "g" ? event.timeStamp : 0;
      if (!inChord || !Object.hasOwn(SHORTCUT_SECTION, event.key)) return;
      const section = SHORTCUT_SECTION[event.key] ?? null;
      if (location.page === "business") router.push(businessHref(location.businessId, section));
      else if (section === null) router.push(APP_HREF);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location, router, paletteOpen]);

  return (
    <div
      className="shell"
      data-drawer={open ? "open" : "closed"}
      data-collapsed={collapsed ? "true" : undefined}
      style={widthVar("--side-w", collapsed ? COLLAPSED_SIDE_W : sidebar.width)}
    >
      <a className="skip-link" href="#app-main">
        Skip to content
      </a>
      <Sidebar
        businesses={businesses}
        location={location}
        open={open}
        collapsed={collapsed}
        closeRef={closeButton}
        onClose={close}
        onToggleCollapsed={toggleCollapsed}
        handle={<ResizeHandle {...sidebar.handleProps} label="Resize sidebar" controls="app-nav" />}
      />
      <div className="scrim" aria-hidden="true" onClick={close} />
      <div className="shell-main" inert={open}>
        <header className="topbar">
          <button
            ref={menuButton}
            type="button"
            className="icon-btn menu-btn"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="app-nav"
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <Link href={APP_HREF} className="topbar-mark" aria-label="Anchored, all businesses">
            <AnchorMark size={20} />
          </Link>
          {/* At phone width the switcher gives way to this title; the drawer lists every business instead */}
          <span className="topbar-title">{titleOf(location, current)}</span>
          <BusinessSwitcher businesses={businesses} location={location} />
          <button type="button" className="palette-open" onClick={() => setPaletteOpen(true)}>
            <Search aria-hidden="true" size={16} />
            Jump to
            <span className="palette-hint" aria-label={`Shortcut ${modKey} K`}>
              <kbd>{modKey}</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <div className="topbar-end">
            {demo}
            {account}
          </div>
        </header>
        <main id="app-main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <CommandPalette
        businesses={businesses}
        location={location}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
