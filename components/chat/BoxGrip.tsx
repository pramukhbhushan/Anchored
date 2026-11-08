"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import styles from "./chat.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The grip on the chat composer's top edge, a focusable `separator`. Dragging
// it up makes the text box taller and dragging it down makes it shorter;
// double-click or Enter hands the size back to the words, so the box grows
// with them again. The up and down arrows step it, Home and End jump to the
// floor and the cap. `useBoxHeight` keeps the owner's pick across visits.

/** The text box's one-line height, the floor a drag stops at. Matches `.input`'s `min-height`. */
export const BOX_MIN = 46;
/** The tallest the text box gets on a tall window; on a short one, half the window. */
const BOX_CAP = 480;
const STEP = 16;
const BIG_STEP = 64;
const STORAGE_KEY = "anchored.layout.chat-box";

/** Return the tallest the text box may be in this window. */
function boxMax(): number {
  return Math.max(BOX_MIN, Math.min(BOX_CAP, Math.round(window.innerHeight / 2)));
}

/** Return `px` rounded and held between the floor and `max`. */
function clampBox(px: number, max: number): number {
  return Math.round(Math.min(max, Math.max(BOX_MIN, px)));
}

/** The owner's text box height: `null` while it sizes to the words, else the pixels they dragged it to. */
export interface BoxHeight {
  readonly height: number | null;
  /** Show `px` without saving it, for each frame of a drag. */
  readonly preview: (px: number | null) => void;
  /** Show and save `px`; `null` clears the saved height. */
  readonly commit: (px: number | null) => void;
}

/** Return the owner's text box height, read from and saved to `localStorage`. */
export function useBoxHeight(): BoxHeight {
  const [height, setHeight] = useState<number | null>(null);

  // Read after mount, so the server's render and the first client render agree.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked, as in some private windows: the box sizes to the words.
      return;
    }
    const px = saved === null ? Number.NaN : Number(saved);
    if (Number.isFinite(px)) setHeight(clampBox(px, boxMax()));
  }, []);

  function commit(px: number | null) {
    setHeight(px);
    try {
      if (px === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(px));
    } catch {
      // Storage blocked: the size holds for this visit only.
    }
  }

  return { height, preview: setHeight, commit };
}

/** One pointer drag in progress. */
interface DragSession {
  readonly pointerId: number;
  readonly startY: number;
  readonly startHeight: number;
  readonly max: number;
  // Updated by every pointer move without a re-render; the next frame reads it.
  y: number;
  moved: boolean;
  frame: number | null;
}

/** Keep the resize cursor everywhere and stop text selection while a drag runs. */
function lockDocument(): void {
  const { style } = document.documentElement;
  style.setProperty("cursor", "row-resize");
  style.setProperty("user-select", "none");
  style.setProperty("-webkit-user-select", "none");
}

/** Undo `lockDocument`. */
function unlockDocument(): void {
  const { style } = document.documentElement;
  style.removeProperty("cursor");
  style.removeProperty("user-select");
  style.removeProperty("-webkit-user-select");
}

/** Render the grip that resizes the text box `box`; `controls` is the box's `id`. */
export function BoxGrip({
  box,
  controls,
  size,
}: {
  readonly box: RefObject<HTMLTextAreaElement | null>;
  readonly controls: string;
  readonly size: BoxHeight;
}) {
  const session = useRef<DragSession | null>(null);
  const [dragging, setDragging] = useState(false);
  const [max, setMax] = useState(BOX_CAP);
  const { height, preview, commit } = size;

  useEffect(() => {
    const update = () => setMax(boxMax());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // A grip removed mid-drag, say when the plan is built, must not leave the whole page unselectable.
  useEffect(
    () => () => {
      const current = session.current;
      if (current === null) return;
      if (current.frame !== null) cancelAnimationFrame(current.frame);
      unlockDocument();
    },
    [],
  );

  /** Return the box's height now: the owner's pick, or what its words make it. */
  function shown(): number {
    return height ?? Math.round(box.current?.getBoundingClientRect().height ?? BOX_MIN);
  }

  /** Return the height the pointer's latest position asks for; up is taller. */
  function settle(current: DragSession): number {
    return clampBox(current.startHeight + current.startY - current.y, current.max);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: shown(),
      max: boxMax(),
      y: event.clientY,
      moved: false,
      frame: null,
    };
    lockDocument();
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current === null || event.pointerId !== current.pointerId) return;
    current.y = event.clientY;
    current.moved = true;
    // Pointer events can outpace the screen; one height a frame is all anyone sees.
    if (current.frame !== null) return;
    current.frame = requestAnimationFrame(() => {
      current.frame = null;
      preview(settle(current));
    });
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current === null || event.pointerId !== current.pointerId) return;
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    session.current = null;
    unlockDocument();
    setDragging(false);
    // A plain click saves nothing, so a box nobody resized keeps growing with its words.
    if (current.moved) commit(settle(current));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? BIG_STEP : STEP;
    const next =
      event.key === "ArrowUp" ? clampBox(shown() + step, max)
      : event.key === "ArrowDown" ? clampBox(shown() - step, max)
      : event.key === "Home" ? BOX_MIN
      : event.key === "End" ? max
      : event.key === "Enter" ? null
      : undefined;
    if (next === undefined) return;
    // Arrows, Home and End would otherwise scroll the thread as well.
    event.preventDefault();
    commit(next);
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the text box"
      aria-controls={controls}
      aria-valuemin={BOX_MIN}
      aria-valuemax={max}
      aria-valuenow={clampBox(height ?? BOX_MIN, max)}
      aria-valuetext={height === null ? "Fits your words" : `${height} pixels tall`}
      title="Drag to resize. Double-click to fit your words."
      tabIndex={0}
      className={styles.grip}
      data-dragging={dragging ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => commit(null)}
      onKeyDown={onKeyDown}
    />
  );
}
