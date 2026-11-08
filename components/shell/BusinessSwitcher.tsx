"use client";

import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { APP_HREF, NEW_BUSINESS_HREF, businessHref } from "@/components/routes";
import type { ShellLocation } from "@/components/shell/location";
import type { BusinessSummary } from "@/components/shell/shell-data";

// =============================================================================
// Module Overview
// =============================================================================
// The business picker in the top bar: a button that opens a panel of links,
// with "All businesses" on top, the owner's businesses apart from the example,
// and "Set up a new business" at the foot. Each business shows its trade and
// its approvals waiting, and a check marks the one that is open. Picking a
// business keeps the section the owner is on. The panel is a disclosure of
// links, not an ARIA menu, so a link still opens in a new tab. The arrow keys,
// Home and End move through it; Escape, a click outside or tabbing away
// closes it.

/** Which link takes focus when the panel opens from the keyboard. */
type OpenFocus = "current" | "last";

/** Return the first letter of `name` for its tile. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

/** Return the panel's links in order. */
function linksIn(panel: HTMLElement | null): HTMLAnchorElement[] {
  return [...(panel?.querySelectorAll<HTMLAnchorElement>("a.switcher-item") ?? [])];
}

/** Focus the panel's last link, or the one marking where the owner is, else its first. */
function focusIn(panel: HTMLElement | null, target: OpenFocus) {
  const items = linksIn(panel);
  const pick = target === "last" ? items.at(-1) : (items.find((a) => a.hasAttribute("aria-current")) ?? items[0]);
  pick?.focus();
}

/** Render the count beside a business, read as ", 3 waiting" by screen readers. */
function Waiting({ value }: { readonly value: number | null }) {
  if (value === null || value === 0) return null;
  return (
    <span className="switcher-count">
      <span className="sr">, </span>
      {value}
      <span className="sr"> waiting</span>
    </span>
  );
}

/** Render one row of the panel; `current` marks where the owner is with a check. */
function Row({
  href,
  tile,
  name,
  detail,
  count = null,
  current,
  page,
  onPick,
}: {
  readonly href: string;
  readonly tile: ReactNode;
  readonly name: string;
  readonly detail?: string;
  readonly count?: number | null;
  readonly current: boolean;
  /** Whether this row is the page itself, as "All businesses" is, rather than a business with pages of its own. */
  readonly page: boolean;
  readonly onPick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        className="switcher-item"
        aria-current={current ? (page ? "page" : "true") : undefined}
        onClick={onPick}
      >
        <span className="switcher-tile" aria-hidden="true">
          {tile}
        </span>
        <span className="switcher-text">
          <span className="switcher-name">{name}</span>
          {detail !== undefined && (
            <span className="switcher-detail">
              <span className="sr">, </span>
              {detail}
            </span>
          )}
        </span>
        <Waiting value={count} />
        <span className="switcher-check" aria-hidden="true">
          {current && <Check size={16} />}
        </span>
      </Link>
    </li>
  );
}

/** Render the business picker for the viewer's `location`. */
export function BusinessSwitcher({
  businesses,
  location,
}: {
  readonly businesses: readonly BusinessSummary[];
  readonly location: ShellLocation;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<OpenFocus | null>(null);
  const panelId = useId();
  const ownId = useId();
  const samplesId = useId();

  const own = businesses.filter((b) => b.kind === "custom");
  const samples = businesses.filter((b) => b.kind === "case");
  const openId = location.page === "business" ? location.businessId : null;
  const section = location.page === "business" ? location.section : null;
  const current = businesses.find((b) => b.id === openId);

  // Pointer for clicks outside, focusin for tabbing out. Blur alone misfires in Safari, where clicking a button doesn't focus it.
  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (event: Event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("focusin", closeIfOutside);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("focusin", closeIfOutside);
    };
  }, [open]);

  // The panel is hidden until this render, so focus moves into it here rather than in the key handler.
  useEffect(() => {
    if (!open || focusOnOpen.current === null) return;
    focusIn(panelRef.current, focusOnOpen.current);
    focusOnOpen.current = null;
  }, [open]);

  function close() {
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (!open) return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    const onTrigger = event.target === triggerRef.current;
    if (onTrigger && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const target: OpenFocus = event.key === "ArrowUp" ? "last" : "current";
      // Already open, no render will run the effect, so focus moves now.
      if (open) focusIn(panelRef.current, target);
      else {
        focusOnOpen.current = target;
        setOpen(true);
      }
      return;
    }

    const items = linksIn(panelRef.current);
    const at = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (at === -1) return;
    const next =
      event.key === "ArrowDown" ? (at + 1) % items.length
      : event.key === "ArrowUp" ? (at - 1 + items.length) % items.length
      : event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  }

  const label =
    current !== undefined ? current.name
    : location.page === "business" ? "This business"
    : location.page === "new" ? "New business"
    : "All businesses";
  const triggerTile =
    current !== undefined ? initialOf(current.name)
    : location.page === "new" ? <Plus size={14} />
    : <LayoutGrid size={14} />;

  return (
    <div ref={rootRef} className="switcher" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="switcher-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className="sr">Business: </span>
        <span className="switcher-tile" aria-hidden="true">
          {triggerTile}
        </span>
        <span className="switcher-label">{label}</span>
        <ChevronsUpDown className="switcher-caret" aria-hidden="true" size={16} />
      </button>

      <div ref={panelRef} id={panelId} className="switcher-panel" hidden={!open}>
        <ul className="switcher-list">
          <Row
            href={APP_HREF}
            tile={<LayoutGrid size={14} />}
            name="All businesses"
            current={location.page === "home"}
            page
            onPick={close}
          />
        </ul>

        {own.length > 0 && (
          <>
            <p className="switcher-group" id={ownId}>
              Your businesses
            </p>
            <ul className="switcher-list" aria-labelledby={ownId}>
              {own.map((b) => (
                <Row
                  key={b.id}
                  href={businessHref(b.id, section)}
                  tile={initialOf(b.name)}
                  name={b.name}
                  detail={b.trade}
                  count={b.pending}
                  current={b.id === openId}
                  page={false}
                  onPick={close}
                />
              ))}
            </ul>
          </>
        )}

        {samples.length > 0 && (
          <>
            <p className="switcher-group" id={samplesId}>
              Example
            </p>
            <ul className="switcher-list" aria-labelledby={samplesId}>
              {samples.map((b) => (
                <Row
                  key={b.id}
                  href={businessHref(b.id, section)}
                  tile={initialOf(b.name)}
                  name={b.name}
                  detail={b.trade}
                  count={b.pending}
                  current={b.id === openId}
                  page={false}
                  onPick={close}
                />
              ))}
            </ul>
          </>
        )}

        <ul className="switcher-list switcher-foot">
          <Row
            href={NEW_BUSINESS_HREF}
            tile={<Plus size={14} />}
            name="Set up a new business"
            current={location.page === "new"}
            page
            onPick={close}
          />
        </ul>
      </div>
    </div>
  );
}
