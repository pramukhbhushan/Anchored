// =============================================================================
// Module Overview
// =============================================================================
// The arithmetic behind resizable panels. `checkBounds` validates a panel's
// limits once; the rest turn a drag, a key press or a saved value into the next
// `WidthState`. No DOM or React here, so the tests run in node.

/** Which edge of the panel carries the handle: `"right"` for a left sidebar, `"left"` for a right rail. */
export type PanelSide = "left" | "right";

/** A panel's size. `width` is the expanded width, kept while `collapsed` so expanding restores it. */
export interface WidthState {
  readonly width: number;
  readonly collapsed: boolean;
}

/** The limits a caller passes in, in CSS pixels. */
interface BoundsInput {
  readonly defaultWidth: number;
  readonly min: number;
  readonly max: number;
  readonly collapseBelow?: number;
  readonly collapsedWidth?: number;
}

/** A panel's validated limits, in CSS pixels. */
export interface WidthBounds {
  readonly defaultWidth: number;
  readonly min: number;
  readonly max: number;
  /** A drag below this collapses the panel; `null` for a panel that never collapses. */
  readonly collapseBelow: number | null;
  /** The width a collapsed panel takes, such as a 64px icon rail. */
  readonly collapsedWidth: number;
}

/** Pixels one arrow press moves the handle. */
export const KEY_STEP = 16;

/** Pixels one arrow press moves the handle with Shift held. */
export const KEY_STEP_LARGE = 64;

/** Every panel's saved width sits under this `localStorage` prefix. */
const STORAGE_PREFIX = "anchored.layout.";

// =============================================================================
// Bounds and state
// =============================================================================

/** Validate `input` and return it as `WidthBounds`, or throw a `RangeError` naming the bad option. */
export function checkBounds(input: BoundsInput): WidthBounds {
  const { defaultWidth, min, max } = input;
  const collapseBelow = input.collapseBelow ?? null;
  // A collapsed panel with no `collapsedWidth` hides completely
  const collapsedWidth = input.collapsedWidth ?? 0;

  if (![defaultWidth, min, max, collapsedWidth].every(Number.isFinite)) {
    throw new RangeError("`defaultWidth`, `min`, `max` and `collapsedWidth` must be finite numbers");
  }
  if (min < 0) throw new RangeError("`min` must be 0 or more");
  if (min > max) throw new RangeError("`min` must not exceed `max`");
  if (defaultWidth < min || defaultWidth > max) {
    throw new RangeError("`defaultWidth` must sit between `min` and `max`");
  }
  if (collapseBelow !== null) {
    // Above `min`, a drag would collapse the panel before it reached its smallest width
    if (!Number.isFinite(collapseBelow) || collapseBelow > min) {
      throw new RangeError("`collapseBelow` must be a number no larger than `min`");
    }
    // Otherwise a drag that starts on a collapsed panel expands it before the pointer moves
    if (collapsedWidth < 0 || collapsedWidth >= collapseBelow) {
      throw new RangeError("`collapsedWidth` must be 0 or more and below `collapseBelow`");
    }
  }
  return { defaultWidth, min, max, collapseBelow, collapsedWidth };
}

/** Return `px` rounded to a whole pixel and held inside `min`..`max`. */
export function clampWidth(px: number, bounds: WidthBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(px)));
}

/** Return the state a panel starts in, and returns to on reset: expanded at `defaultWidth`. */
export function initialState(bounds: WidthBounds): WidthState {
  return { width: bounds.defaultWidth, collapsed: false };
}

/** Return the width the panel takes on screen: `collapsedWidth` while collapsed, else `width`. */
export function panelWidth(state: WidthState, bounds: WidthBounds): number {
  return state.collapsed ? bounds.collapsedWidth : state.width;
}

// =============================================================================
// Drag
// =============================================================================

/** Return the raw width a drag asks for, before clamping, from where it started and where the pointer is now. */
export function draggedWidth(startWidth: number, startX: number, x: number, side: PanelSide): number {
  // A handle on the right edge grows the panel as the pointer moves right; one on the left edge, as it moves left
  const direction = side === "right" ? 1 : -1;
  return startWidth + (x - startX) * direction;
}

/** Return the state for a drag to `dragged` pixels: collapsed below `collapseBelow`, else clamped. */
export function stateFromDrag(dragged: number, current: WidthState, bounds: WidthBounds): WidthState {
  if (bounds.collapseBelow !== null && dragged < bounds.collapseBelow) {
    return { width: current.width, collapsed: true };
  }
  return { width: clampWidth(dragged, bounds), collapsed: false };
}

// =============================================================================
// Keyboard
// =============================================================================

/** Return the state after pressing `key` on the handle, or `null` when the handle ignores that key. */
export function stateFromKey(
  key: string,
  shiftKey: boolean,
  current: WidthState,
  side: PanelSide,
  bounds: WidthBounds,
): WidthState | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowRight": {
      // Arrows move the handle on screen, so the one pointing away from the panel grows it
      const grows = (key === "ArrowRight") === (side === "right");
      // A collapsed panel first opens at its remembered width; shrinking it further does nothing
      if (current.collapsed) return grows ? { width: current.width, collapsed: false } : current;
      const step = shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      return { width: clampWidth(current.width + (grows ? step : -step), bounds), collapsed: false };
    }
    case "Home":
      return { width: bounds.min, collapsed: false };
    case "End":
      return { width: bounds.max, collapsed: false };
    case "Enter":
      return bounds.collapseBelow === null ? null : { width: current.width, collapsed: !current.collapsed };
    default:
      return null;
  }
}

// =============================================================================
// Storage format
// =============================================================================

/** Return the `localStorage` key for a panel, `anchored.layout.<storageKey>`. */
export function storageKeyFor(storageKey: string): string {
  if (storageKey.trim() === "") throw new RangeError("`storageKey` must not be empty");
  return `${STORAGE_PREFIX}${storageKey}`;
}

/** Return `state` as the string `parseStored` reads back. */
export function serializeState(state: WidthState): string {
  return JSON.stringify({ width: state.width, collapsed: state.collapsed });
}

/** Return the state saved in `raw`, or `null` when it is missing or unreadable. */
export function parseStored(raw: string | null, bounds: WidthBounds): WidthState | null {
  if (raw === null || raw === "") return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // A truncated or hand-edited value falls back to the default width
    return null;
  }
  if (typeof value !== "object" || value === null || !("width" in value)) return null;
  const { width } = value;
  if (typeof width !== "number" || !Number.isFinite(width)) return null;
  // A panel that can no longer collapse opens, rather than staying hidden with no way back
  const collapsed = bounds.collapseBelow !== null && "collapsed" in value && value.collapsed === true;
  // The limits may have changed since this was saved, so clamp the old width instead of discarding it
  return { width: clampWidth(width, bounds), collapsed };
}
