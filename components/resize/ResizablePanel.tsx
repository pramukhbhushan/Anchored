"use client";

import { useCallback, useId, useSyncExternalStore, type ReactNode } from "react";
import { ResizeHandle } from "@/components/resize/ResizeHandle";
import { useResizableWidth, widthVar, type ResizableWidthOptions } from "@/components/resize/use-resizable-width";
import styles from "./resize.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// `ResizablePanel` wraps content in a container that owns its width: it sets
// `--panel-w` for the shell's CSS to use, marks `data-collapsed`, and renders a
// `ResizeHandle` on the inner edge. Below `mobileBreakpoint` it drops all three
// and the shell's own mobile layout applies. Server pages can render it.

/** The viewport width, in CSS pixels, below which the panel stops being resizable. */
const DEFAULT_MOBILE_BREAKPOINT = 768;

/** Props for `ResizablePanel`: the `useResizableWidth` options plus the handle's label. */
export interface ResizablePanelProps extends ResizableWidthOptions {
  /** Names the handle for screen readers, such as "Resize outbox". */
  readonly label: string;
  /** Below this viewport width, in CSS pixels, the handle hides; defaults to 768. */
  readonly mobileBreakpoint?: number;
  readonly id?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Return whether the viewport is narrower than `px`, or `null` before hydration when the server can't know. */
function useViewportBelow(px: number): boolean | null {
  const query = `(width < ${px}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => null,
  );
}

/** Render `children` in a container sized by `--panel-w`, with a `ResizeHandle` on its inner edge. */
export function ResizablePanel({
  label,
  mobileBreakpoint = DEFAULT_MOBILE_BREAKPOINT,
  id,
  className,
  children,
  ...options
}: ResizablePanelProps) {
  const panel = useResizableWidth(options);
  const generatedId = useId();
  const panelId = id ?? generatedId;
  const narrow = useViewportBelow(mobileBreakpoint);
  // The server can't see the viewport, so it renders the wide layout's width but no handle; a phone never flashes one
  const resizable = narrow !== true;

  return (
    <div
      id={panelId}
      className={className === undefined ? styles.panel : `${styles.panel} ${className}`}
      style={resizable ? widthVar("--panel-w", panel.panelWidth) : undefined}
      data-collapsed={resizable && panel.collapsed ? "" : undefined}
    >
      {children}
      {narrow === false && <ResizeHandle {...panel.handleProps} label={label} controls={panelId} />}
    </div>
  );
}
