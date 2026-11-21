import { Inbox, Layers, LayoutDashboard, MessageSquare, Plug, Store, ToggleRight, Workflow, Wrench, type LucideIcon } from "lucide-react";
import type { Section } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// What the sidebar, the command palette and the keyboard shortcuts share
// about each business page: its icon and its `g` shortcut. `SHORTCUT_SECTION`
// is the reverse map the shortcut handler reads; `SIDEBAR_COOKIE` is shared
// by the shell that writes it and the layout that reads it.

/** A business page, with the overview written `overview`. */
export type PageKey = Section | "overview";

/** The icon for each business page. */
export const SECTION_ICON: Readonly<Record<PageKey, LucideIcon>> = {
  overview: LayoutDashboard,
  chat: MessageSquare,
  workflows: Workflow,
  automations: ToggleRight,
  tools: Wrench,
  approvals: Inbox,
  connections: Plug,
  stack: Layers,
  profile: Store,
};

/** The two-key shortcut for the pages that have one, such as `g` then `w` for Workflows. */
export const SECTION_SHORTCUT: Readonly<Partial<Record<PageKey, readonly [string, string]>>> = {
  overview: ["g", "o"],
  workflows: ["g", "w"],
  tools: ["g", "t"],
  approvals: ["g", "a"],
};

/** The cookie that remembers a collapsed sidebar; the `/app` layout reads it so the first paint is right. */
export const SIDEBAR_COOKIE = "anchored_sidebar";

/** The page each second key opens after `g`, read off `SECTION_SHORTCUT`; the overview is `null`. */
export const SHORTCUT_SECTION: Readonly<Record<string, Section | null>> = Object.fromEntries(
  (Object.entries(SECTION_SHORTCUT) as [PageKey, readonly [string, string]][]).map(([page, [, key]]) => [
    key,
    page === "overview" ? null : page,
  ]),
);
