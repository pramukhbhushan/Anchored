import { describe, expect, it } from "vitest";
import {
  checkBounds,
  clampWidth,
  draggedWidth,
  initialState,
  KEY_STEP,
  KEY_STEP_LARGE,
  panelWidth,
  parseStored,
  serializeState,
  stateFromDrag,
  stateFromKey,
  storageKeyFor,
  type WidthState,
} from "@/components/resize/width";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the resize arithmetic with the app's three real panels: the
// sidebar that collapses to an icon rail, and the two right rails. Covers
// option checks, drag and collapse, keyboard steps and reading saved values.

const sidebar = checkBounds({ defaultWidth: 256, min: 200, max: 420, collapseBelow: 140, collapsedWidth: 64 });
const knowsRail = checkBounds({ defaultWidth: 360, min: 280, max: 560 });

/** Return an expanded state at `width`. */
function open(width: number): WidthState {
  return { width, collapsed: false };
}

describe("checkBounds", () => {
  it("accepts the sidebar, knows rail and outbox settings", () => {
    expect(sidebar).toEqual({ defaultWidth: 256, min: 200, max: 420, collapseBelow: 140, collapsedWidth: 64 });
    expect(knowsRail.collapseBelow).toBeNull();
    expect(checkBounds({ defaultWidth: 380, min: 300, max: 600 }).collapsedWidth).toBe(0);
  });

  it("rejects limits that cannot hold together", () => {
    expect(() => checkBounds({ defaultWidth: 300, min: 400, max: 300 })).toThrow(/`min` must not exceed `max`/);
    expect(() => checkBounds({ defaultWidth: 600, min: 200, max: 420 })).toThrow(/`defaultWidth`/);
    expect(() => checkBounds({ defaultWidth: 256, min: -1, max: 420 })).toThrow(/`min` must be 0/);
    expect(() => checkBounds({ defaultWidth: Number.NaN, min: 200, max: 420 })).toThrow(/finite/);
  });

  it("rejects a collapse threshold the panel could not drag past", () => {
    expect(() => checkBounds({ defaultWidth: 256, min: 200, max: 420, collapseBelow: 240 })).toThrow(
      /`collapseBelow`/,
    );
    expect(() =>
      checkBounds({ defaultWidth: 256, min: 200, max: 420, collapseBelow: 140, collapsedWidth: 140 }),
    ).toThrow(/`collapsedWidth`/);
  });
});

describe("clampWidth", () => {
  it("holds a width inside min and max and rounds it to a whole pixel", () => {
    expect(clampWidth(150, sidebar)).toBe(200);
    expect(clampWidth(900, sidebar)).toBe(420);
    expect(clampWidth(301.6, sidebar)).toBe(302);
  });
});

describe("panelWidth", () => {
  it("is the collapsed width while collapsed and the expanded width otherwise", () => {
    expect(panelWidth({ width: 300, collapsed: true }, sidebar)).toBe(64);
    expect(panelWidth(open(300), sidebar)).toBe(300);
  });
});

describe("dragging", () => {
  it("grows a left sidebar as the pointer moves right", () => {
    expect(draggedWidth(256, 100, 140, "right")).toBe(296);
  });

  it("grows a right rail as the pointer moves left", () => {
    expect(draggedWidth(360, 900, 860, "left")).toBe(400);
  });

  it("stops at min and max", () => {
    expect(stateFromDrag(170, open(256), sidebar)).toEqual(open(200));
    expect(stateFromDrag(700, open(256), sidebar)).toEqual(open(420));
  });

  it("collapses below the threshold and remembers the width to restore", () => {
    expect(stateFromDrag(139, open(230), sidebar)).toEqual({ width: 230, collapsed: true });
  });

  it("restores a collapsed panel once the drag passes the threshold again", () => {
    const collapsed: WidthState = { width: 230, collapsed: true };
    expect(stateFromDrag(100, collapsed, sidebar)).toEqual(collapsed);
    expect(stateFromDrag(140, collapsed, sidebar)).toEqual(open(200));
    expect(stateFromDrag(310, collapsed, sidebar)).toEqual(open(310));
  });

  it("never collapses a panel without a threshold", () => {
    expect(stateFromDrag(0, open(360), knowsRail)).toEqual(open(280));
  });
});

describe("keyboard", () => {
  it("moves the handle a step in the arrow's direction on either edge", () => {
    expect(stateFromKey("ArrowRight", false, open(256), "right", sidebar)).toEqual(open(256 + KEY_STEP));
    expect(stateFromKey("ArrowLeft", false, open(256), "right", sidebar)).toEqual(open(256 - KEY_STEP));
    expect(stateFromKey("ArrowLeft", false, open(360), "left", knowsRail)).toEqual(open(360 + KEY_STEP));
    expect(stateFromKey("ArrowRight", false, open(360), "left", knowsRail)).toEqual(open(360 - KEY_STEP));
  });

  it("takes a larger step with Shift held", () => {
    expect(stateFromKey("ArrowRight", true, open(256), "right", sidebar)).toEqual(open(256 + KEY_STEP_LARGE));
  });

  it("stops arrow steps at min and max without collapsing", () => {
    expect(stateFromKey("ArrowLeft", true, open(210), "right", sidebar)).toEqual(open(200));
    expect(stateFromKey("ArrowRight", true, open(400), "right", sidebar)).toEqual(open(420));
  });

  it("sends Home to min and End to max, opening a collapsed panel", () => {
    const collapsed: WidthState = { width: 300, collapsed: true };
    expect(stateFromKey("Home", false, collapsed, "right", sidebar)).toEqual(open(200));
    expect(stateFromKey("End", false, open(300), "right", sidebar)).toEqual(open(420));
  });

  it("opens a collapsed panel at its remembered width with the arrow that grows it", () => {
    const collapsed: WidthState = { width: 300, collapsed: true };
    expect(stateFromKey("ArrowRight", false, collapsed, "right", sidebar)).toEqual(open(300));
    expect(stateFromKey("ArrowLeft", false, collapsed, "right", sidebar)).toEqual(collapsed);
  });

  it("toggles collapse with Enter only on a collapsible panel", () => {
    expect(stateFromKey("Enter", false, open(300), "right", sidebar)).toEqual({ width: 300, collapsed: true });
    expect(stateFromKey("Enter", false, { width: 300, collapsed: true }, "right", sidebar)).toEqual(open(300));
    expect(stateFromKey("Enter", false, open(360), "left", knowsRail)).toBeNull();
  });

  it("ignores keys the handle does not use", () => {
    expect(stateFromKey("Tab", false, open(256), "right", sidebar)).toBeNull();
    expect(stateFromKey(" ", false, open(256), "right", sidebar)).toBeNull();
  });
});

describe("saved widths", () => {
  it("names the key under anchored.layout", () => {
    expect(storageKeyFor("sidebar")).toBe("anchored.layout.sidebar");
    expect(() => storageKeyFor(" ")).toThrow(/`storageKey`/);
  });

  it("reads back what it saved", () => {
    const saved: WidthState = { width: 312, collapsed: true };
    expect(parseStored(serializeState(saved), sidebar)).toEqual(saved);
  });

  it("returns null for missing or unreadable values so the default applies", () => {
    for (const raw of [null, "", "not json", "{", "312", "[]", "null", '"wide"', "{}", '{"width":"312"}']) {
      expect(parseStored(raw, sidebar)).toBeNull();
    }
  });

  it("clamps a saved width that the current limits no longer allow", () => {
    expect(parseStored('{"width":9000,"collapsed":false}', sidebar)).toEqual(open(420));
    expect(parseStored('{"width":12}', sidebar)).toEqual(open(200));
  });

  it("opens a saved collapsed panel that can no longer collapse", () => {
    expect(parseStored('{"width":400,"collapsed":true}', knowsRail)).toEqual(open(400));
  });

  it("treats anything but true as expanded", () => {
    expect(parseStored('{"width":300,"collapsed":"yes"}', sidebar)).toEqual(open(300));
  });

  it("starts expanded at the default width", () => {
    expect(initialState(sidebar)).toEqual(open(256));
  });
});
