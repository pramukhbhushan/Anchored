"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ResizeControl } from "@/components/resize/use-resizable-width";
import { draggedWidth, panelWidth, stateFromDrag, stateFromKey, type WidthState } from "@/components/resize/width";
import styles from "./resize.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// `ResizeHandle` is the draggable edge of a resizable panel, a focusable
// `separator`. Pointer drags preview the width once per animation frame and
// save it on release; double-click resets it; arrows, Home, End and Enter move
// or collapse it from the keyboard. Place it inside a positioned panel.

/** One pointer drag in progress. */
interface DragSession {
  readonly pointerId: number;
  readonly startX: number;
  readonly startWidth: number;
  // Updated by every pointer move without a re-render; the next frame reads it
  x: number;
  latest: WidthState;
  moved: boolean;
  frame: number | null;
}

/** Props for `ResizeHandle`: the `handleProps` from `useResizableWidth` plus a label. */
interface ResizeHandleProps extends ResizeControl {
  /** Names the handle for screen readers, such as "Resize sidebar". */
  readonly label: string;
  /** The `id` of the panel this handle resizes. */
  readonly controls?: string;
  readonly className?: string;
}

// =============================================================================
// Document lock while dragging
// =============================================================================

/** Keep the resize cursor everywhere and stop text selection while a drag runs. */
function lockDocument(): void {
  const { style } = document.documentElement;
  style.setProperty("cursor", "col-resize");
  style.setProperty("user-select", "none");
  // Safari has long read only the prefixed property
  style.setProperty("-webkit-user-select", "none");
}

/** Undo `lockDocument`. */
function unlockDocument(): void {
  const { style } = document.documentElement;
  style.removeProperty("cursor");
  style.removeProperty("user-select");
  style.removeProperty("-webkit-user-select");
}

// =============================================================================
// Handle
// =============================================================================

/** Render the drag handle on a panel's inner edge; spread `handleProps` from `useResizableWidth` onto it. */
export function ResizeHandle({ side, bounds, state, preview, commit, reset, label, controls, className }: ResizeHandleProps) {
  const session = useRef<DragSession | null>(null);
  const [dragging, setDragging] = useState(false);

  // A handle removed mid-drag, say by a breakpoint, must not leave the whole page unselectable
  useEffect(
    () => () => {
      const current = session.current;
      if (current === null) return;
      if (current.frame !== null) cancelAnimationFrame(current.frame);
      unlockDocument();
    },
    [],
  );

  /** Return the state the pointer's latest position asks for. */
  function settle(current: DragSession): WidthState {
    return stateFromDrag(draggedWidth(current.startWidth, current.startX, current.x, side), current.latest, bounds);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: panelWidth(state, bounds),
      x: event.clientX,
      latest: state,
      moved: false,
      frame: null,
    };
    lockDocument();
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current === null || event.pointerId !== current.pointerId) return;
    current.x = event.clientX;
    current.moved = true;
    // Pointer events can outpace the screen; one width update per frame is all anyone sees
    if (current.frame !== null) return;
    current.frame = requestAnimationFrame(() => {
      current.frame = null;
      current.latest = settle(current);
      preview(current.latest);
    });
  }

  // A cancelled drag, such as one the browser took over, also saves what is on screen, so screen and storage agree
  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current === null || event.pointerId !== current.pointerId) return;
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    session.current = null;
    unlockDocument();
    setDragging(false);
    // A plain click saves nothing, so a viewer who never resized keeps following `defaultWidth`
    if (current.moved) commit(settle(current));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Leave browser and system shortcuts such as Alt+Left alone
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = stateFromKey(event.key, event.shiftKey, state, side, bounds);
    if (next === null) return;
    // Arrows, Home and End would otherwise scroll the page as well
    event.preventDefault();
    commit(next);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      // `aria-valuenow` must stay inside min..max, so a collapsed panel reports the width it will reopen at
      aria-valuenow={state.width}
      aria-valuetext={state.collapsed ? "Collapsed" : `${state.width} pixels`}
      tabIndex={0}
      className={className === undefined ? styles.handle : `${styles.handle} ${className}`}
      data-resize-handle=""
      data-side={side}
      data-collapsed={state.collapsed ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
    />
  );
}
