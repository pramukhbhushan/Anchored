# Resizable panels

Drag-to-resize for the sidebar and the right rails. Each panel saves its width in `localStorage` under `anchored.layout.<storageKey>`.

| File | What it gives you |
| --- | --- |
| `use-resizable-width.ts` | `useResizableWidth(options)`: the width, `collapsed`, setters and `handleProps`. Also `widthVar(name, px)` for an inline CSS variable. |
| `ResizeHandle.tsx` | `<ResizeHandle {...handleProps} label="..." />`: the draggable, focusable edge. |
| `ResizablePanel.tsx` | `<ResizablePanel>`: a container that sets `--panel-w` and renders the handle. Server pages can render it. |
| `width.ts` | The pure math, tested in `width.test.ts`. |

Two ways to mount it:

- In a client component that owns the grid, such as `AppShell`, call the hook, put the width on the grid as a CSS variable, and render `<ResizeHandle>` inside the panel.
- In a server page, wrap the rail in `<ResizablePanel>`, make its grid column `auto`, and give the panel `width: var(--panel-w)`.

## What the handle does

- Drag with mouse, pen or touch. Dragging below `collapseBelow` collapses the panel, and dragging back out reopens it at `min` or wider.
- Double-click resets to `defaultWidth` and forgets the saved value.
- Keyboard: Left and Right move the handle 16px, or 64px with Shift. Home goes to `min`, End to `max`, and Enter collapses or expands a panel that has `collapseBelow`.
- The server and the first client paint use `defaultWidth`. The saved width applies right after hydration, so nothing mismatches.

## Sidebar

Default 256, min 200, max 420. Below 140 it collapses to a 64px icon rail. In `AppShell`:

```tsx
import { ResizeHandle } from "@/components/resize/ResizeHandle";
import { useResizableWidth, widthVar } from "@/components/resize/use-resizable-width";

const sidebar = useResizableWidth({
  storageKey: "sidebar",
  side: "right",
  defaultWidth: 256,
  min: 200,
  max: 420,
  collapseBelow: 140,
  collapsedWidth: 64,
});

<div
  className="shell"
  style={widthVar("--side-w", sidebar.panelWidth)}
  data-collapsed={sidebar.collapsed ? "true" : undefined}
>
  <Sidebar
    collapsed={sidebar.collapsed}
    onToggleCollapse={() => sidebar.setCollapsed(!sidebar.collapsed)}
    handle={<ResizeHandle {...sidebar.handleProps} label="Resize sidebar" controls="app-nav" />}
  />
  ...
</div>
```

`Sidebar` takes the handle as a prop and renders it as the last child of `.side`, which is sticky and so anchors it. `panelWidth` is already 64 while collapsed, so the existing `.shell{grid-template-columns:var(--side-w) ...}` and `.shell[data-collapsed="true"]` rules work as they are. Hide the handle in the drawer with `.side [data-resize-handle]{display:none}` inside the `max-width:959px` block.

## Chat "What Anchored knows" rail

Default 360, min 280, max 560. The handle sits on the rail's left edge. In `ChatWindow`, around `KnowsCard`:

```tsx
import { ResizablePanel } from "@/components/resize/ResizablePanel";

<ResizablePanel
  storageKey="chat-knows"
  side="left"
  defaultWidth={360}
  min={280}
  max={560}
  label="Resize What Anchored knows"
  className={styles.knowsPanel}
>
  <KnowsCard ... />
</ResizablePanel>
```

```css
.intake{grid-template-columns:minmax(0,1fr) auto}
.knowsPanel{grid-area:knows;width:var(--panel-w);display:flex;flex-direction:column;min-height:0;--resize-line:transparent}
.knowsPanel > .knows{flex:1}
@container (max-width:759px){
  .knowsPanel{width:auto}
  .knowsPanel [data-resize-handle]{display:none}
}
```

The wrapper takes over `grid-area: knows`, so drop it from `.knows`. `.knows` draws its own border, so `--resize-line: transparent` keeps the hairline from doubling it.

## Approvals outbox rail

Default 380, min 300, max 600. The handle sits on the rail's left edge.

```tsx
<ResizablePanel
  storageKey="approvals-outbox"
  side="left"
  defaultWidth={380}
  min={300}
  max={600}
  label="Resize outbox"
  className="outbox-panel"
>
  <aside className="rail outbox" id="outbox" aria-labelledby="outbox-title">...</aside>
</ResizablePanel>
```

```css
@container app (min-width:820px){
  .with-rail:has(> .outbox-panel){grid-template-columns:minmax(0,1fr) auto}
  .outbox-panel{width:var(--panel-w);position:sticky;top:calc(var(--top-h) + 16px)}
}
@container app (max-width:819px){.outbox-panel [data-resize-handle]{display:none}}
```

`.with-rail` uses `align-items: start`, so the wrapper is only as tall as the outbox and a sticky `.outbox` inside it can't move. Make the wrapper sticky instead, as above, and drop the sticky rule from `.outbox`. The panel's own `position: relative` has zero specificity, so your rule wins.

## Things to know when mounting

- `mobileBreakpoint` (default 768) reads the viewport, but both rails stack on `@container` widths. Hide the handle where a rail stacks with `[data-resize-handle]{display:none}` in that container query, as the examples do.
- Below `mobileBreakpoint`, `ResizablePanel` drops `--panel-w`, `data-collapsed` and the handle. Write `width: var(--panel-w)` only in rules for the wide layout, or `width: var(--panel-w, auto)`.
- The handle is absolutely positioned. Its panel needs `position` other than `static`. `.side` is already sticky. Don't put it inside an element with `overflow: hidden`, because half of its 8px hit area sits outside the panel.
- At rest the handle draws a 1px `var(--line)` hairline just outside the panel's padding box, which lands exactly on a 1px border of the panel itself. A border on a child sits inside that, so the lines double; set `--resize-line: transparent` on the panel.
- The sidebar remembers collapse in a cookie today, so the server renders the icon rail. The hook keeps collapse in `localStorage`, so a collapsed viewer sees the full sidebar until hydration ends. Pick one store before wiring `setCollapsed` to the existing toggle.
- `min` and `max` are absolute. On a narrow window a 560px rail can squeeze the chat thread, so cap the panel with `max-width` if the thread needs room.
