"use client";

import { BookOpen, LayoutGrid, PanelLeftClose, PanelLeftOpen, Plus, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { AnchorMark } from "@/components/ui/AnchorMark";
import { ResetDemoButton } from "@/components/shell/ResetDemoButton";
import { APP_HREF, NEW_BUSINESS_HREF, SECTIONS, businessHref } from "@/components/routes";
import type { ShellLocation } from "@/components/shell/location";
import { SECTION_ICON } from "@/components/shell/nav";
import type { BusinessSummary } from "@/components/shell/shell-data";

// =============================================================================
// Module Overview
// =============================================================================
// The app sidebar: the open business's pages with the approvals count, then
// every business the viewer can open, then "How it's built", "Reset demo" and
// the collapse toggle, with a drag handle on its right edge. Collapsed, it is
// a 64px icon rail whose names move into tooltips. At phone width `AppShell`
// slides it in as a drawer instead.

// Breathing room left above or below the active link after it is scrolled into view.
const REVEAL_MARGIN = 12;

/** Render the count beside a nav item, read as ", 3 waiting" by screen readers. */
function Count({ value }: { readonly value: number | null }) {
  if (value === null || value === 0) return null;
  return (
    <span className="side-count">
      <span className="sr">, </span>
      {value}
      <span className="sr"> waiting</span>
    </span>
  );
}

/** Render one sidebar link with its icon; `current` marks it as the open page, `tip` names it when collapsed. */
function SideLink({
  href,
  icon: Icon,
  label,
  current,
  tip,
  count = null,
}: {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly current: boolean;
  readonly tip: boolean;
  readonly count?: number | null;
}) {
  return (
    <Link href={href} className="side-link" aria-current={current ? "page" : undefined} title={tip ? label : undefined}>
      <Icon aria-hidden="true" size={18} />
      <span className="side-text">{label}</span>
      <Count value={count} />
    </Link>
  );
}

/** Render one group of businesses under `label`, each with an initial tile and its count. */
function BusinessGroup({
  label,
  businesses,
  openId,
}: {
  readonly label: string;
  readonly businesses: readonly BusinessSummary[];
  readonly openId: string | null;
}) {
  if (businesses.length === 0) return null;
  return (
    <div className="side-group">
      <p className="side-label">{label}</p>
      <ul className="side-list">
        {businesses.map((b) => (
          <li key={b.id}>
            <Link
              href={businessHref(b.id)}
              className="side-link side-biz"
              title={b.name}
              // The business is open but its overview may not be the page, so this marks it as current, not as the page.
              aria-current={b.id === openId ? "true" : undefined}
            >
              <span className="side-initial" aria-hidden="true">
                {b.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="side-text">{b.name}</span>
              <Count value={b.pending} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Scroll `container` just enough to show `item`, without moving the page itself. */
function reveal(container: HTMLElement, item: HTMLElement) {
  const box = container.getBoundingClientRect();
  const target = item.getBoundingClientRect();
  if (target.top < box.top) container.scrollTop -= box.top - target.top + REVEAL_MARGIN;
  else if (target.bottom > box.bottom) container.scrollTop += target.bottom - box.bottom + REVEAL_MARGIN;
}

/** Render the sidebar for `location`; `open` is the drawer state at phone width, `collapsed` the icon-rail state. */
export function Sidebar({
  businesses,
  location,
  open,
  collapsed,
  closeRef,
  onClose,
  onToggleCollapsed,
  handle,
}: {
  readonly businesses: readonly BusinessSummary[];
  readonly location: ShellLocation;
  readonly open: boolean;
  readonly collapsed: boolean;
  readonly closeRef: Ref<HTMLButtonElement>;
  readonly onClose: () => void;
  readonly onToggleCollapsed: () => void;
  /** The drag handle on the sidebar's right edge; `.side` is sticky, so it anchors the handle. */
  readonly handle: ReactNode;
}) {
  const scroller = useRef<HTMLElement>(null);
  const openId = location.page === "business" ? location.businessId : null;
  const current = businesses.find((b) => b.id === openId) ?? null;
  const own = businesses.filter((b) => b.kind === "custom");
  const samples = businesses.filter((b) => b.kind === "case");
  const section = location.page === "business" ? location.section : null;
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  useEffect(() => {
    const container = scroller.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (container && active) reveal(container, active);
  }, [openId, section, open]);

  return (
    <aside id="app-nav" className="side" aria-label="App">
      <div className="side-head">
        <Link href={APP_HREF} className="mark" title={collapsed ? "Anchored, all businesses" : undefined}>
          <AnchorMark />
          <span className="mark-text">Anchored</span>
        </Link>
        <button ref={closeRef} type="button" className="icon-btn side-close" aria-label="Close menu" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <nav className="side-scroll" ref={scroller} aria-label="Businesses and pages">
        <ul className="side-list">
          <li>
            <SideLink
              href={APP_HREF}
              icon={LayoutGrid}
              label="All businesses"
              current={location.page === "home"}
              tip={collapsed}
            />
          </li>
        </ul>
        {current !== null && (
          <div className="side-group">
            <p className="side-label side-current" title={current.name}>
              {current.name}
            </p>
            <ul className="side-list">
              {SECTIONS.map((item) => (
                <li key={item.label}>
                  <SideLink
                    href={businessHref(current.id, item.section)}
                    icon={SECTION_ICON[item.section ?? "overview"]}
                    label={item.label}
                    current={section === item.section}
                    tip={collapsed}
                    count={item.section === "approvals" ? current.pending : null}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        <BusinessGroup label="Your businesses" businesses={own} openId={openId} />
        <BusinessGroup label="Sample businesses" businesses={samples} openId={openId} />
        <ul className="side-list side-new">
          <li>
            <SideLink
              href={NEW_BUSINESS_HREF}
              icon={Plus}
              label="Start a new business"
              current={location.page === "new"}
              tip={collapsed}
            />
          </li>
        </ul>
      </nav>
      <div className="side-foot">
        <Link href="/built" className="side-foot-link" title={collapsed ? "How it's built" : undefined}>
          <BookOpen aria-hidden="true" size={16} />
          <span className="side-foot-text">How it&apos;s built</span>
        </Link>
        <ResetDemoButton ownCount={own.length} />
        <button
          type="button"
          className="side-foot-link side-collapse"
          title={collapsed ? collapseLabel : undefined}
          onClick={onToggleCollapsed}
        >
          <CollapseIcon aria-hidden="true" size={16} />
          <span className="side-foot-text">{collapseLabel}</span>
        </button>
      </div>
      {/* The icon rail has one width, so it has nothing to drag */}
      {!collapsed && handle}
    </aside>
  );
}
