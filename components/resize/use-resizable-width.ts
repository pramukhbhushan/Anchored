"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  checkBounds,
  clampWidth,
  initialState,
  panelWidth,
  parseStored,
  serializeState,
  storageKeyFor,
  type PanelSide,
  type WidthBounds,
  type WidthState,
} from "@/components/resize/width";

// =============================================================================
// Module Overview
// =============================================================================
// `useResizableWidth` holds one panel's width and collapsed state, saves it to
// `localStorage` and hands `ResizeHandle` what it needs as `handleProps`. The
// server and the first client paint use `defaultWidth`; the saved value lands
// right after hydration, so the two renders always match.

/** Options for `useResizableWidth`; every width is in CSS pixels. */
export interface ResizableWidthOptions {
  /** Saved under `anchored.layout.<storageKey>`. */
  readonly storageKey: string;
  readonly defaultWidth: number;
  readonly min: number;
  readonly max: number;
  /** A drag below this collapses the panel; leave it unset for a panel that never collapses. */
  readonly collapseBelow?: number;
  /** The width of a collapsed panel, such as 64 for an icon rail; defaults to 0. */
  readonly collapsedWidth?: number;
  readonly side: PanelSide;
}

/** What `ResizeHandle` needs to read and move its panel. */
export interface ResizeControl {
  readonly side: PanelSide;
  readonly bounds: WidthBounds;
  readonly state: WidthState;
  /** Show `next` without saving it; the handle calls this once per drag frame. */
  readonly preview: (next: WidthState) => void;
  /** Show `next` and save it. */
  readonly commit: (next: WidthState) => void;
  /** Return to `defaultWidth`, expanded, and forget the saved value. */
  readonly reset: () => void;
}

/** One panel's live size, its setters and the props for its `ResizeHandle`. */
interface ResizableWidth {
  /** The expanded width, kept while collapsed. */
  readonly width: number;
  /** The width the panel takes now: `collapsedWidth` while collapsed, else `width`. */
  readonly panelWidth: number;
  readonly collapsed: boolean;
  /** Set the expanded width, clamped to `min`..`max`, and save it. */
  readonly setWidth: (px: number) => void;
  /** Collapse or expand the panel and save it; does nothing when `collapseBelow` is unset. */
  readonly setCollapsed: (collapsed: boolean) => void;
  /** Return to `defaultWidth`, expanded, and forget the saved value. */
  readonly reset: () => void;
  /** Spread onto `<ResizeHandle>` together with its `label`. */
  readonly handleProps: ResizeControl;
}

// =============================================================================
// Storage
// =============================================================================

// Storage throws in some private windows and when site data is blocked. Each
// caller then keeps the width in memory for this visit, which is all it can do.

/** Return the saved state under `key`, or `null` when there is none or storage is unavailable. */
function readSaved(key: string, bounds: WidthBounds): WidthState | null {
  try {
    return parseStored(window.localStorage.getItem(key), bounds);
  } catch {
    return null;
  }
}

/** Save `state` under `key`, or remove the key when `state` is `null`. */
function save(key: string, state: WidthState | null): void {
  try {
    if (state === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, serializeState(state));
  } catch {
    // The width still applies on screen; it just won't survive a reload
  }
}

// =============================================================================
// Hook
// =============================================================================

/** Hold a panel's width and collapsed state, saved per `storageKey`, with the props for its `ResizeHandle`. */
export function useResizableWidth(options: ResizableWidthOptions): ResizableWidth {
  const { storageKey, defaultWidth, min, max, collapseBelow, collapsedWidth, side } = options;
  const key = storageKeyFor(storageKey);
  const bounds = useMemo(
    () => checkBounds({ defaultWidth, min, max, collapseBelow, collapsedWidth }),
    [defaultWidth, min, max, collapseBelow, collapsedWidth],
  );
  const [state, setState] = useState<WidthState>(() => initialState(bounds));

  // The server has no storage, so the saved width can only apply after hydration
  useEffect(() => {
    setState(readSaved(key, bounds) ?? initialState(bounds));
  }, [key, bounds]);

  const commit = (next: WidthState) => {
    setState(next);
    save(key, next);
  };

  // Forgetting the value, rather than saving the default, lets a later change to `defaultWidth` reach this viewer
  const reset = () => {
    setState(initialState(bounds));
    save(key, null);
  };

  const setWidth = (px: number) => {
    if (!Number.isFinite(px)) throw new RangeError("`setWidth` needs a finite number of pixels");
    commit({ width: clampWidth(px, bounds), collapsed: state.collapsed });
  };

  const setCollapsed = (collapsed: boolean) => {
    if (bounds.collapseBelow === null) return;
    commit({ width: state.width, collapsed });
  };

  return {
    width: state.width,
    panelWidth: panelWidth(state, bounds),
    collapsed: state.collapsed,
    setWidth,
    setCollapsed,
    reset,
    handleProps: { side, bounds, state, preview: setState, commit, reset },
  };
}

/** Return an inline style that sets the custom property `name` to `px` pixels, such as `--side-w`. */
export function widthVar(name: `--${string}`, px: number): CSSProperties {
  return { [name]: `${px}px` };
}
