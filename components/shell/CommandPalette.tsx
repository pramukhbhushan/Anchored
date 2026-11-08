"use client";

import { Building2, CornerDownLeft, LayoutGrid, Plus, Search, BookOpen, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { APP_HREF, NEW_BUSINESS_HREF, SECTIONS, businessHref } from "@/components/routes";
import { SECTION_ICON, SECTION_SHORTCUT } from "@/components/shell/nav";
import type { ShellLocation } from "@/components/shell/location";
import type { BusinessSummary } from "@/components/shell/shell-data";

// =============================================================================
// Module Overview
// =============================================================================
// The command palette (Cmd or Ctrl+K): type to filter, arrows to move, Enter
// to go. It lists the open business's pages with their `g` shortcuts, every
// business, and the app-wide pages. A native modal `<dialog>` keeps focus in
// it and closes on Escape.

/** One row in the palette. */
interface Command {
  readonly id: string;
  readonly group: string;
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** Keys shown on the right, such as `["g", "w"]`. */
  readonly keys?: readonly string[];
}

/** Build every command for the viewer's `location`. */
function commandsFor(businesses: readonly BusinessSummary[], location: ShellLocation): Command[] {
  const current = location.page === "business" ? businesses.find((b) => b.id === location.businessId) : undefined;
  const pages: Command[] =
    current === undefined
      ? []
      : SECTIONS.map(({ section, label }) => ({
          id: `page:${section ?? "overview"}`,
          group: current.name,
          label,
          href: businessHref(current.id, section),
          icon: SECTION_ICON[section ?? "overview"],
          keys: SECTION_SHORTCUT[section ?? "overview"],
        }));
  // The owner's own businesses come first, as in the sidebar; the example follows.
  const ordered = [...businesses.filter((b) => b.kind === "custom"), ...businesses.filter((b) => b.kind === "case")];
  const places: Command[] = ordered.map((b) => ({
    id: `biz:${b.id}`,
    group: "Businesses",
    label: b.kind === "case" ? `${b.name} (example)` : b.name,
    href: businessHref(b.id),
    icon: Building2,
  }));
  const app: Command[] = [
    { id: "app:all", group: "Anchored", label: "All businesses", href: APP_HREF, icon: LayoutGrid },
    { id: "app:new", group: "Anchored", label: "Start a new business", href: NEW_BUSINESS_HREF, icon: Plus },
    { id: "app:built", group: "Anchored", label: "How it's built", href: "/built", icon: BookOpen },
  ];
  return [...pages, ...places, ...app];
}

/** Keep the commands whose label or group contains every word of `query`. */
function filter(commands: readonly Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...commands];
  return commands.filter((c) => {
    const text = `${c.label} ${c.group}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Render the palette; `open` is controlled by the shell, which also owns the shortcut that opens it. */
export function CommandPalette({
  businesses,
  location,
  open,
  onClose,
}: {
  readonly businesses: readonly BusinessSummary[];
  readonly location: ShellLocation;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const commands = useMemo(() => commandsFor(businesses, location), [businesses, location]);
  const shown = useMemo(() => filter(commands, query), [commands, query]);

  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;
    if (open && !node.open) {
      setQuery("");
      setActive(0);
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  // Keep the highlighted row on screen as the arrows move it.
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function go(command: Command | undefined) {
    if (command === undefined) return;
    onClose();
    router.push(command.href);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (shown.length === 0 ? 0 : (index + step + shown.length) % shown.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(shown[active]);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Jump to a page or business"
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself; clicks inside land on its children.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette-search">
        <Search aria-hidden="true" size={18} />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown.length > 0 ? `${listId}-${active}` : undefined}
          aria-label="Search pages and businesses"
          placeholder="Jump to a page or business"
          value={query}
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      <ul className="palette-list" id={listId} role="listbox" aria-label="Results">
        {shown.length === 0 && <li className="palette-empty">Nothing matches. Try a business name or a page such as Tools.</li>}
        {shown.map((command, index) => {
          const Icon = command.icon;
          const startsGroup = index === 0 || shown[index - 1]?.group !== command.group;
          return (
            <li key={command.id} role="presentation">
              {startsGroup && (
                <p className="palette-group" aria-hidden="true">
                  {command.group}
                </p>
              )}
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className="palette-item"
                tabIndex={-1}
                onMouseMove={() => setActive(index)}
                onClick={() => go(command)}
              >
                <Icon aria-hidden="true" size={16} />
                {command.label}
                {command.keys !== undefined && (
                  <span className="palette-keys" aria-label={`Shortcut ${command.keys.join(" then ")}`}>
                    {command.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="palette-foot" aria-hidden="true">
        <span>
          <kbd>&uarr;</kbd>
          <kbd>&darr;</kbd> to move
        </span>
        <span>
          <kbd>
            <CornerDownLeft size={12} />
          </kbd>{" "}
          to open
        </span>
        <span>
          <kbd>/</kbd> to type in chat
        </span>
        <span>
          <kbd>Esc</kbd> to close
        </span>
      </div>
    </dialog>
  );
}
