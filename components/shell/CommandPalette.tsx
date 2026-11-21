"use client";

import { Command as CommandMenu } from "cmdk";
import paletteStyles from "./command-menu.module.css";
import {
  Building2,
  LayoutGrid,
  Plus,
  Search,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  APP_HREF,
  NEW_BUSINESS_HREF,
  SECTIONS,
  businessHref,
  agentHref,
} from "@/components/routes";
import { SECTION_ICON, SECTION_SHORTCUT, agentIcon } from "@/components/shell/nav";
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
function commandsFor(
  businesses: readonly BusinessSummary[],
  location: ShellLocation,
): Command[] {
  const current =
    location.page === "business"
      ? businesses.find((b) => b.id === location.businessId)
      : undefined;
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
  const ordered = [
    ...businesses.filter((b) => b.kind === "custom"),
    ...businesses.filter((b) => b.kind === "case"),
  ];
  const places: Command[] = ordered.map((b) => ({
    id: `biz:${b.id}`,
    group: "Businesses",
    label: b.kind === "case" ? `${b.name} (example)` : b.name,
    href: businessHref(b.id),
    icon: Building2,
  }));
  const app: Command[] = [
    {
      id: "app:all",
      group: "Anchored",
      label: "All businesses",
      href: APP_HREF,
      icon: LayoutGrid,
    },
    {
      id: "app:new",
      group: "Anchored",
      label: "Set up a new business",
      href: NEW_BUSINESS_HREF,
      icon: Plus,
    },
    {
      id: "app:built",
      group: "Anchored",
      label: "How it's built",
      href: "/built",
      icon: BookOpen,
    },
  ];
  const agents: Command[] =
    current === undefined
      ? []
      : (current.agents ?? []).map((agent) => ({
          id: `agent:${agent.id}`,
          group: `${current.name} agents`,
          label: agent.name,
          href: agentHref(current.id, agent.id),
          icon: agentIcon(agent.id),
        }));
  return [...pages, ...agents, ...places, ...app];
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
  const [query, setQuery] = useState("");
  const commands = useMemo(
    () => commandsFor(businesses, location),
    [businesses, location],
  );
  const shown = useMemo(() => filter(commands, query), [commands, query]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      setQuery("");
      node.showModal();
    } else if (!open && node.open) node.close();
  }, [open]);
  function go(command: Command) {
    onClose();
    router.push(command.href);
  }
  const groups = [...new Set(shown.map((command) => command.group))];
  return (
    <dialog
      ref={dialog}
      className={`palette ${paletteStyles.dialog}`}
      aria-label="Jump to a page or business"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <CommandMenu
        label="Search pages and businesses"
        shouldFilter={false}
        loop
      >
        <div className="palette-search">
          <Search aria-hidden="true" size={18} />
          <CommandMenu.Input
            aria-label="Search pages and businesses"
            placeholder="Jump to a page or business"
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
        </div>
        <CommandMenu.List
          className={`palette-list ${paletteStyles.list}`}
          aria-label="Results"
        >
          <CommandMenu.Empty className="palette-empty">
            Nothing matches. Try a business name or a page such as Tools.
          </CommandMenu.Empty>
          {groups.map((group) => (
            <CommandMenu.Group
              key={group}
              heading={group}
              className={paletteStyles.group}
            >
              {shown
                .filter((c) => c.group === group)
                .map((command) => {
                  const Icon = command.icon;
                  return (
                    <CommandMenu.Item
                      key={command.id}
                      value={command.id}
                      onSelect={() => go(command)}
                      className={`palette-item ${paletteStyles.item}`}
                    >
                      <Icon aria-hidden="true" size={16} />
                      <span>{command.label}</span>
                      {command.keys && (
                        <span
                          className="palette-keys"
                          aria-label={`Shortcut ${command.keys.join(" then ")}`}
                        >
                          {command.keys.map((key) => (
                            <kbd key={key}>{key}</kbd>
                          ))}
                        </span>
                      )}
                    </CommandMenu.Item>
                  );
                })}
            </CommandMenu.Group>
          ))}
        </CommandMenu.List>
        <div className="palette-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </CommandMenu>
    </dialog>
  );
}
