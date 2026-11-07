import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ResizablePanel, type ResizablePanelProps } from "@/components/resize/ResizablePanel";

// =============================================================================
// Module Overview
// =============================================================================
// The resize handle as a keyboard and screen reader user meets it, mounted the
// way server pages mount it, inside `ResizablePanel`. The handle is a focusable
// separator whose ARIA values report the width; arrows, Home, End, Enter and a
// double-click move it, the width survives a reload, and below the mobile
// breakpoint there is no handle at all.

/** The app's sidebar: a handle on its right edge, and a collapse to a 64px icon rail below 140px. */
const SIDEBAR = {
  storageKey: "sidebar-test",
  side: "right",
  defaultWidth: 256,
  min: 200,
  max: 420,
  collapseBelow: 140,
  collapsedWidth: 64,
  label: "Resize sidebar",
} as const satisfies Omit<ResizablePanelProps, "children">;

/** The chat's "What Anchored knows" rail: a handle on its left edge, and no collapse. */
const KNOWS_RAIL = {
  storageKey: "knows-test",
  side: "left",
  defaultWidth: 360,
  min: 280,
  max: 560,
  label: "Resize What Anchored knows",
} as const satisfies Omit<ResizablePanelProps, "children">;

const DESKTOP_WIDTH = 1280;

/** Resize the test window, which is what the panel's media query reads. */
function setViewportWidth(width: number): void {
  const { happyDOM } = window as unknown as { happyDOM: { setViewport(size: { width: number }): void } };
  act(() => happyDOM.setViewport({ width }));
}

function renderPanel(props: Omit<ResizablePanelProps, "children">) {
  return render(
    <ResizablePanel {...props}>
      <p>Panel content</p>
    </ResizablePanel>,
  );
}

/** Tab to the handle, as a keyboard user would. */
async function focusHandle(): Promise<HTMLElement> {
  await userEvent.tab();
  const handle = screen.getByRole("separator");
  expect(handle).toHaveFocus();
  return handle;
}

afterEach(() => setViewportWidth(DESKTOP_WIDTH));

describe("ResizeHandle", () => {
  it("is a labelled separator that reports its width and range", () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);

    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuemin", "200");
    expect(handle).toHaveAttribute("aria-valuemax", "420");
    expect(handle).toHaveAttribute("aria-valuenow", "256");
    expect(handle).toHaveAttribute("aria-valuetext", "256 pixels");
  });

  it("names the panel it resizes", () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);

    const controlled = document.getElementById(screen.getByRole("separator").getAttribute("aria-controls") ?? "");
    expect(controlled).toHaveTextContent("Panel content");
  });

  it("moves 16px per arrow press, and grows with the arrow pointing away from the panel", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);
    const handle = await focusHandle();

    await userEvent.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "272");

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "240");
  });

  it("grows a right-hand rail with the left arrow", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(KNOWS_RAIL);
    const handle = await focusHandle();

    await userEvent.keyboard("{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "376");

    await userEvent.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "360");
  });

  it("moves 64px per arrow press with Shift held", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);
    const handle = await focusHandle();

    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(handle).toHaveAttribute("aria-valuenow", "320");

    await userEvent.keyboard("{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}");
    expect(handle).toHaveAttribute("aria-valuenow", "200");
  });

  it("jumps to the smallest width with Home and the largest with End", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);
    const handle = await focusHandle();

    await userEvent.keyboard("{End}");
    expect(handle).toHaveAttribute("aria-valuenow", "420");

    await userEvent.keyboard("{Home}");
    expect(handle).toHaveAttribute("aria-valuenow", "200");
  });

  it("leaves arrows pressed with Ctrl, Alt or Cmd to the browser", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);
    const handle = await focusHandle();

    await userEvent.keyboard("{Control>}{ArrowRight}{/Control}{Alt>}{ArrowLeft}{/Alt}{Meta>}{End}{/Meta}");

    expect(handle).toHaveAttribute("aria-valuenow", "256");
  });

  it("collapses and reopens with Enter on a panel that can collapse", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);
    const handle = await focusHandle();
    await userEvent.keyboard("{ArrowRight}");

    await userEvent.keyboard("{Enter}");
    expect(handle).toHaveAttribute("aria-valuetext", "Collapsed");
    // A collapsed panel still reports the width it will reopen at, inside min and max.
    expect(handle).toHaveAttribute("aria-valuenow", "272");

    await userEvent.keyboard("{Enter}");
    expect(handle).toHaveAttribute("aria-valuetext", "272 pixels");
  });

  it("ignores Enter on a panel that cannot collapse", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(KNOWS_RAIL);
    const handle = await focusHandle();

    await userEvent.keyboard("{Enter}");

    expect(handle).toHaveAttribute("aria-valuetext", "360 pixels");
  });

  it("returns to the default width on double-click", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);
    const handle = await focusHandle();
    await userEvent.keyboard("{End}");

    await userEvent.dblClick(handle);

    expect(handle).toHaveAttribute("aria-valuenow", "256");
  });

  it("keeps the chosen width across a reload, and forgets it after a reset", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    const first = renderPanel(SIDEBAR);
    await focusHandle();
    await userEvent.keyboard("{End}");
    first.unmount();

    const second = renderPanel(SIDEBAR);
    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("aria-valuenow", "420");

    fireEvent.doubleClick(handle);
    second.unmount();

    renderPanel(SIDEBAR);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "256");
  });
});

describe("ResizablePanel", () => {
  it("shows its content with a handle on a wide screen", () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);

    expect(screen.getByText("Panel content")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize sidebar" })).toBeInTheDocument();
  });

  it("drops the handle below the mobile breakpoint but keeps the content", () => {
    setViewportWidth(500);
    renderPanel(SIDEBAR);

    expect(screen.getByText("Panel content")).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("drops the handle when the window narrows past the breakpoint, and brings it back", () => {
    setViewportWidth(DESKTOP_WIDTH);
    renderPanel(SIDEBAR);
    expect(screen.getByRole("separator")).toBeInTheDocument();

    setViewportWidth(700);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();

    setViewportWidth(900);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("honours a custom breakpoint", () => {
    setViewportWidth(900);
    renderPanel({ ...SIDEBAR, mobileBreakpoint: 960 });

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});
