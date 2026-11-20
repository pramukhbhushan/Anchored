"use client";

import { ArrowRight, CalendarCheck, CircleDollarSign, Maximize2, Minus, Plus, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { workflowIcon } from "@/components/business/workflow-icons";
import { ChangeHandler } from "@/components/workflows/ChangeHandler";
import type { ChangeOption, HandlerKind } from "@/components/workflows/flow";
import styles from "@/components/workflows/map.module.css";
import type { StageId } from "@/lib/domain/stages";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The Workflows map: the business in the middle, the three parts of its day
// around it, and every job on one ring outside them, all on screen at once so
// nothing hides behind a click. Drafts waiting for the owner's OK come first:
// a strip above the map links straight to each one in Approvals, and on the
// map a yellow trail runs from the business to every job with a draft
// waiting, which wears a count. Tapping a job opens a panel with its
// automations, each a link to its own page, and the way to change who handles
// it. Tapping a stage zooms in on it and its jobs. The owner can also zoom
// with the buttons, a pinch, Ctrl and the scroll wheel, or a double-click,
// and drag the map to move it. Ring colors match the plan band and the bill:
// ink for Anchored, green for a tool the owner has, blue for a new tool, grey
// dashes for work nobody handles. On a narrow screen the jobs hang in one
// column under each part of the day, which the page scrolls instead of a
// zoom. React renders every circle once; a small spring engine in
// `useEffect` moves them, so hovering pops a circle and the rest drift and
// settle. Reduced motion places them still.

/** One automation inside a job, told in the owner's words. */
interface MapAutomation {
  readonly key: string;
  readonly name: string;
  readonly summary: string;
  /** Drafts waiting for the owner's OK. */
  readonly waiting: number;
  /** The automation's own page. */
  readonly href: string;
  /** The first waiting draft in Approvals, or `null` when none waits. */
  readonly reviewHref: string | null;
}

/** One job on the map, its automations, and who else could handle it. */
export interface MapJob {
  readonly id: WorkflowId;
  readonly name: string;
  readonly kind: HandlerKind;
  readonly handler: string;
  readonly note: string;
  readonly automations: readonly MapAutomation[];
  readonly options: readonly ChangeOption[];
  /** The tool comparison for this job. */
  readonly compareHref: string;
}

/** One part of the day on the map and its jobs. */
export interface MapStage {
  readonly id: StageId;
  readonly name: string;
  readonly blurb: string;
  readonly jobs: readonly MapJob[];
}

type Selection = { readonly type: "stage"; readonly id: StageId } | { readonly type: "job"; readonly id: WorkflowId } | null;

type NodeType = "company" | "stage" | "job";

interface MapNode {
  readonly id: string;
  readonly type: NodeType;
  readonly parent: string | null;
  readonly label: string;
  /** The label broken into at most two lines. */
  readonly lines: readonly string[];
  readonly sub: string;
  /** Drafts waiting for the owner's OK in this circle and everything under it. */
  readonly waiting: number;
  readonly tip: string;
  readonly kind: HandlerKind | null;
  readonly icon: LucideIcon | null;
  readonly stage?: MapStage;
  readonly job?: MapJob;
}

/** Which side of its circle a label sits on: away from the middle, so it never runs into a stage. */
type LabelAt = "below" | "above" | "left" | "right";

/** Where a layout puts one circle and its label. */
interface Spot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly shown: boolean;
  readonly label: LabelAt;
}

/** Live position and motion for one circle; the engine mutates it every frame. */
interface Body {
  x: number; y: number; vx: number; vy: number;
  r: number; tr: number; tx: number; ty: number;
  o: number; to: number; s: number; sv: number;
  dim: number; phase: number; label: LabelAt; ox: number; oy: number;
}

interface NodeEls {
  g: SVGGElement | null; body: SVGCircleElement | null; ring: SVGCircleElement | null; halo: SVGCircleElement | null;
  lab: SVGTextElement | null; sub: SVGTextElement | null; icon: SVGGElement | null; badge: SVGGElement | null;
  link: SVGPathElement | null; trail: SVGPathElement | null; inner: SVGTextElement | null;
}

const STAGE_ICON: Readonly<Record<StageId, LucideIcon>> = { customers: Users, serving: CalendarCheck, running: CircleDollarSign };
const KEY: Readonly<Record<HandlerKind, string>> = {
  agent: "Anchored drafts it, you approve",
  owned: "A tool you have does it",
  new: "A new tool does it",
  none: "Nobody does it yet",
};
const KINDS: readonly HandlerKind[] = ["agent", "owned", "new", "none"];
/** Below this chart width the ring gets too small to read, so the jobs hang in columns instead. */
const COLUMN_BELOW = 720;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const waitingOf = (jobs: readonly MapJob[]) => jobs.reduce((sum, j) => sum + j.automations.reduce((s, a) => s + a.waiting, 0), 0);
const rad = (d: number) => (d * Math.PI) / 180;

/** Break `text` at the space nearest its middle when it runs past `max` characters. */
function wrap(text: string, max = 16): string[] {
  if (text.length <= max) return [text];
  const mid = text.length / 2;
  let best = -1;
  for (let i = text.indexOf(" "); i !== -1; i = text.indexOf(" ", i + 1)) {
    if (best === -1 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
  }
  return best === -1 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

/** List the business, its stages and its jobs as one tree of circles. */
function nodesOf(businessName: string, stages: readonly MapStage[]): MapNode[] {
  const jobCount = stages.reduce((n, s) => n + s.jobs.length, 0);
  const out: MapNode[] = [
    { id: "hq", type: "company", parent: null, label: businessName, lines: wrap(businessName, 18), sub: plural(jobCount, "job"), waiting: 0, kind: null, icon: null,
      tip: "This is your business. Every job on the map connects back here." },
  ];
  for (const stage of stages) {
    const w = waitingOf(stage.jobs);
    out.push({ id: `s:${stage.id}`, type: "stage", parent: "hq", label: stage.name, lines: wrap(stage.name),
      sub: w > 0 ? `${plural(w, "draft")} for your OK` : plural(stage.jobs.length, "job"), waiting: w, kind: null, icon: STAGE_ICON[stage.id], stage,
      tip: `${stage.blurb}. Tap to list its jobs.` });
    for (const job of stage.jobs) {
      const jw = waitingOf([job]);
      out.push({ id: `j:${job.id}`, type: "job", parent: `s:${stage.id}`, label: job.name, lines: wrap(job.name),
        sub: jw > 0 ? `${plural(jw, "draft")} for your OK` : job.handler, waiting: jw, kind: job.kind, icon: workflowIcon(job.id), stage, job,
        tip: job.kind === "agent" ? "Anchored writes the messages for this job. Nothing goes out until you approve it."
          : job.kind === "none" ? "Nobody handles this yet, so you do it yourself. Tap to pick who could."
          : `${job.handler} does this job. ${job.note}.` });
    }
  }
  return out;
}

/** Label a job on the ring at `deg` on its outer side: above or below near the top and bottom, beside it at the sides. */
function outward(deg: number): LabelAt {
  const s = Math.sin(rad(deg));
  if (s < -0.55) return "above";
  if (s > 0.55) return "below";
  return Math.cos(rad(deg)) > 0 ? "right" : "left";
}

/**
 * Put the business in the middle, every job on one ring around it, and each stage between the business and
 * its jobs. `wide` stretches the ring sideways to fill a wide chart.
 */
function ringLayout(stages: readonly MapStage[], wide: number): Map<string, Spot> {
  const spots = new Map<string, Spot>([["hq", { x: 0, y: 0, r: 64, shown: true, label: "below" }]]);
  const total = stages.reduce((n, s) => n + s.jobs.length, 0);
  // Each stage leaves a gap after its jobs, so they read as one group.
  const gap = 0.8;
  const step = 360 / Math.max(1, total + gap * stages.length);
  const ring = Math.max(330, 230 / (2 * Math.sin(rad(Math.min(step, 180) / 2))));
  const hub = Math.max(200, ring * 0.5);
  // The first stage's jobs center on the top of the ring.
  let a = -90 - (((stages[0]?.jobs.length ?? 1) - 1) * step) / 2;
  for (const stage of stages) {
    const n = stage.jobs.length;
    const mid = rad(a + ((n - 1) * step) / 2);
    spots.set(`s:${stage.id}`, { x: hub * wide * Math.cos(mid), y: hub * Math.sin(mid), r: 54, shown: true, label: "below" });
    stage.jobs.forEach((job, k) => {
      const deg = a + k * step;
      spots.set(`j:${job.id}`, { x: ring * wide * Math.cos(rad(deg)), y: ring * Math.sin(rad(deg)), r: 44, shown: true, label: outward(deg) });
    });
    a += (n + gap) * step;
  }
  return spots;
}

/** Hang each stage's jobs in one column under it, for a narrow screen; the business itself stays off this view. */
function columnLayout(stages: readonly MapStage[]): Map<string, Spot> {
  const spots = new Map<string, Spot>([["hq", { x: -56, y: -60, r: 0, shown: false, label: "right" }]]);
  let y = 0;
  for (const stage of stages) {
    spots.set(`s:${stage.id}`, { x: -56, y, r: 32, shown: true, label: "right" });
    y += 88;
    for (const job of stage.jobs) {
      spots.set(`j:${job.id}`, { x: 0, y, r: 28, shown: true, label: "right" });
      y += 84;
    }
    y += 20;
  }
  return spots;
}

/** Render the map for `businessName` and its `stages`, with the drafts waiting in `approvalsHref` up top. */
export function WorkflowMap({
  businessId,
  businessName,
  stages,
  approvalsHref,
  pendingTotal,
}: {
  readonly businessId: string;
  readonly businessName: string;
  readonly stages: readonly MapStage[];
  readonly approvalsHref: string;
  /** Every draft waiting in Approvals, including ones from work outside these jobs. */
  readonly pendingTotal: number;
}) {
  const nodes = useMemo(() => nodesOf(businessName, stages), [businessName, stages]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const children = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) if (n.parent !== null) m.set(n.parent, [...(m.get(n.parent) ?? []), n.id]);
    return m;
  }, [nodes]);

  const [sel, setSel] = useState<Selection>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const els = useRef(new Map<string, NodeEls>());
  const selRef = useRef<Selection>(sel);
  const activateRef = useRef<(id: string) => void>(() => {});
  const zoomRef = useRef<{ by: (factor: number) => void; fit: () => void }>({ by: () => {}, fit: () => {} });
  const relayout = useRef<(focus?: boolean) => void>(() => {});

  const refFor = (id: string, part: keyof NodeEls) => (el: SVGElement | null) => {
    const entry = els.current.get(id) ?? { g: null, body: null, ring: null, halo: null, lab: null, sub: null, icon: null, badge: null, link: null, trail: null, inner: null };
    (entry as unknown as Record<string, SVGElement | null>)[part] = el;
    els.current.set(id, entry);
  };

  activateRef.current = (id: string) => {
    const n = byId.get(id);
    if (!n) return;
    const next: Selection = n.type === "stage" && n.stage ? { type: "stage", id: n.stage.id } : n.type === "job" && n.job ? { type: "job", id: n.job.id } : null;
    // Tapping the open circle again closes it.
    setSel((cur) => (cur && next && cur.type === next.type && cur.id === next.id ? null : next));
  };

  useEffect(() => {
    selRef.current = sel;
    relayout.current(true);
    // In columns the panel sits under a tall map, so bring it to the owner.
    if (sel !== null && wrapRef.current?.dataset.layout === "column") {
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    }
  }, [sel]);

  // Esc closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  // ---------------------------------------------------------------- the engine
  useEffect(() => {
    const svg = svgRef.current, world = worldRef.current, chart = chartRef.current, wrapEl = wrapRef.current;
    if (!svg || !world || !chart || !wrapEl) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bodies = new Map<string, Body>(nodes.map((n) => [n.id, { x: 0, y: 0, vx: 0, vy: 0, r: 0, tr: 0, tx: 0, ty: 0, o: 0, to: 0, s: 1, sv: 0, dim: 1, phase: Math.random() * 6.28, label: "below", ox: 0, oy: 0 }]));
    const cam = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1, px: 0, py: 0 };
    let vp = { w: 800, h: 600, panel: 0 };
    let column = false;
    let hover: string | null = null;
    let hot: Set<string> | null = null;
    let lit: Set<string> | null = null;
    // What the camera shows: the whole map, one stage after a tap on it, or wherever the owner zoomed.
    let view: "fit" | "stage" | "user" = "fit";
    let drag: { id: string; sx: number; sy: number; dx: number; dy: number; moved: boolean } | null = null;
    let pan: { sx: number; sy: number; px: number; py: number; moved: boolean } | null = null;
    let raf = 0;

    const related = (id: string) => new Set([id, byId.get(id)?.parent ?? "", ...(children.get(id) ?? [])].filter(Boolean));
    const selId = () => { const s = selRef.current; return s === null ? null : s.type === "stage" ? `s:${s.id}` : `j:${s.id}`; };

    /** Place every circle and point the camera; `focus` says the owner just opened or closed something. */
    const layout = (focus = false) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      column = rect.width < COLUMN_BELOW;
      const sid = selId();
      vp = { w: rect.width, h: rect.height, panel: !column && sid !== null ? Math.min(360, rect.width * 0.4) + 24 : 0 };
      wrapEl.dataset.layout = column ? "column" : "ring";
      lit = sid === null ? null : related(sid);
      // A wide chart stretches the ring sideways, so the jobs spread into the room beside it.
      const spots = column ? columnLayout(stages) : ringLayout(stages, Math.max(1, Math.min(1.5, (rect.width / rect.height) * 0.85)));
      // Each circle's box with its label, so the camera can fit the whole map or one stage.
      const boxes = new Map<string, readonly [number, number, number, number]>();
      for (const n of nodes) {
        const b = bodies.get(n.id)!, s = spots.get(n.id);
        if (!s) continue;
        const r = s.r + (n.type !== "company" && n.waiting > 0 ? 6 : 0);
        b.tx = s.x; b.ty = s.y; b.tr = s.shown ? r : 0; b.to = s.shown ? 1 : 0; b.label = s.label;
        const g = els.current.get(n.id)?.g;
        if (g) {
          g.dataset.label = s.label;
          g.dataset.sel = n.id === sid ? "true" : "false";
          g.style.pointerEvents = s.shown ? "auto" : "none";
          g.setAttribute("tabindex", s.shown ? "0" : "-1");
          g.setAttribute("aria-hidden", s.shown ? "false" : "true");
        }
        if (!s.shown) continue;
        // Room for the label: about 11px a letter, 10px a letter for the monospace subline, two lines and the subline.
        const w = Math.max(Math.max(...n.lines.map((l) => l.length)) * 11, n.sub.length * 10), h = n.lines.length * 22 + 22;
        const across = s.label === "left" || s.label === "right";
        boxes.set(n.id, [
          s.x - (s.label === "left" ? r + 14 + w : across ? r + 10 : Math.max(r, w / 2) + 10),
          s.y - (s.label === "above" ? r + 24 + h : across ? Math.max(r, h / 2) + 12 : r + 18),
          s.x + (s.label === "right" ? r + 14 + w : across ? r + 10 : Math.max(r, w / 2) + 10),
          s.y + (s.label === "below" ? r + 22 + h : across ? Math.max(r, h / 2) + 8 : r + 10),
        ]);
      }
      // Nothing placed means nothing to aim at, and an empty box would send the camera to NaN.
      if (boxes.size === 0) return;
      const bounds = (ids: ReadonlySet<string> | null) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [id, [a, b, c, d]] of boxes) {
          if (ids !== null && !ids.has(id)) continue;
          x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
        }
        return { x0, y0, x1, y1 };
      };
      // Point the camera at a box, as close as `max` allows; return the scale that would fit it whole.
      const aim = ({ x0, y0, x1, y1 }: ReturnType<typeof bounds>, max: number) => {
        const fit = Math.min((vp.w - vp.panel - 32) / (x1 - x0), (vp.h - 40) / (y1 - y0));
        cam.tx = (x0 + x1) / 2; cam.ty = (y0 + y1) / 2; cam.px = 0; cam.py = 0;
        cam.ts = Math.max(0.45, Math.min(max, fit));
        return fit;
      };
      const f = sid === null ? undefined : bodies.get(sid);
      const open = selRef.current;
      if (column) {
        view = "fit";
        const all = bounds(null);
        cam.tx = (all.x0 + all.x1) / 2; cam.ty = (all.y0 + all.y1) / 2; cam.px = 0; cam.py = 0;
        cam.ts = Math.max(0.6, Math.min(1.1, (vp.w - 24) / (all.x1 - all.x0)));
        // The chart grows to the column's height, and the page scrolls instead of the map shrinking.
        const want = Math.ceil((all.y1 - all.y0) * cam.ts + 24);
        if (Math.abs(chart.clientHeight - want) > 2) chart.style.height = `${want}px`;
      } else {
        chart.style.height = "";
        if (open?.type === "stage" && sid !== null && (focus || view === "stage")) {
          // Tapping a stage zooms in on it and its jobs, and a resize keeps it there.
          view = "stage";
          aim(bounds(new Set([sid, ...(children.get(sid) ?? [])])), 1.6);
        } else if (view !== "fit" && f) {
          // Zoomed in: keep the zoom and bring the open job into view beside the panel.
          cam.tx = f.tx; cam.ty = f.ty; cam.px = 0; cam.py = 0;
        } else if (!(view === "user" && f === undefined)) {
          // Otherwise show it all; with too little room beside the panel, center on what is open instead.
          view = "fit";
          if (aim(bounds(null), 1.15) < 0.45 && f) { cam.tx = f.tx; cam.ty = f.ty; }
        }
      }
      if (f) f.sv += 0.09;
    };
    relayout.current = (focus = false) => requestAnimationFrame(() => layout(focus));

    const origin = () => ({ ox: (vp.w - vp.panel) / 2 + cam.px, oy: vp.h / 2 + cam.py });
    const toWorld = (cx: number, cy: number): [number, number] => {
      const r = svg.getBoundingClientRect(), { ox, oy } = origin();
      return [(cx - r.left - ox) / cam.s + cam.x, (cy - r.top - oy) / cam.s + cam.y];
    };

    /** Zoom to `scale`, keeping the spot under the screen point (`cx`, `cy`) where it is; `instant` skips the ease, for a pinch. */
    const zoomTo = (scale: number, cx: number, cy: number, instant = false) => {
      if (column) return;
      const rect = svg.getBoundingClientRect(), { ox, oy } = origin();
      const sx = cx - rect.left - ox, sy = cy - rect.top - oy;
      const [wx, wy] = [cam.x + sx / cam.s, cam.y + sy / cam.s];
      cam.ts = Math.max(0.3, Math.min(2.5, scale));
      cam.tx = wx - sx / cam.ts; cam.ty = wy - sy / cam.ts;
      if (instant) { cam.x = cam.tx; cam.y = cam.ty; cam.s = cam.ts; }
      view = "user";
    };
    const zoomBy = (factor: number) => {
      const rect = svg.getBoundingClientRect();
      zoomTo(cam.ts * factor, rect.left + (vp.w - vp.panel) / 2, rect.top + vp.h / 2);
    };
    zoomRef.current = { by: zoomBy, fit: () => { view = "fit"; layout(); } };

    const setHover = (id: string | null) => {
      if (drag?.moved) return;
      hover = id;
      hot = id ? related(id) : null;
      for (const n of nodes) els.current.get(n.id)?.g?.classList.toggle(styles.hot ?? "hot", n.id === id);
      const tip = tipRef.current;
      if (tip) {
        if (id && matchMedia("(hover: hover)").matches) { tip.textContent = byId.get(id)?.tip ?? ""; tip.hidden = false; }
        else tip.hidden = true;
      }
    };

    // Pointer and keyboard wiring on each circle.
    const cleanups: (() => void)[] = [];
    for (const n of nodes) {
      const g = els.current.get(n.id)?.g;
      if (!g) continue;
      const enter = () => setHover(n.id), leave = () => setHover(null);
      const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateRef.current(n.id); } };
      const down = (e: PointerEvent) => {
        if (e.button !== 0 || pinch) return;
        e.stopPropagation();
        const b = bodies.get(n.id)!, [wx, wy] = toWorld(e.clientX, e.clientY);
        drag = { id: n.id, sx: e.clientX, sy: e.clientY, dx: wx - b.x, dy: wy - b.y, moved: false };
      };
      g.addEventListener("pointerenter", enter); g.addEventListener("pointerleave", leave);
      g.addEventListener("focus", enter); g.addEventListener("blur", leave);
      g.addEventListener("keydown", key); g.addEventListener("pointerdown", down);
      cleanups.push(() => {
        g.removeEventListener("pointerenter", enter); g.removeEventListener("pointerleave", leave);
        g.removeEventListener("focus", enter); g.removeEventListener("blur", leave);
        g.removeEventListener("keydown", key); g.removeEventListener("pointerdown", down);
      });
    }
    const move = (e: PointerEvent) => {
      if (drag) {
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
        if (drag.moved) {
          const b = bodies.get(drag.id)!, [wx, wy] = toWorld(e.clientX, e.clientY);
          b.ox = wx - drag.dx - b.tx; b.oy = wy - drag.dy - b.ty;
        }
      } else if (pan) {
        if (!pan.moved && Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) > 5) pan.moved = true;
        cam.px = pan.px + (e.clientX - pan.sx); cam.py = pan.py + (e.clientY - pan.sy);
      }
    };
    const up = () => {
      if (drag) {
        const b = bodies.get(drag.id)!;
        if (!drag.moved) activateRef.current(drag.id);
        b.ox = 0; b.oy = 0; drag = null;
      }
      // A tap on the open sea closes the panel.
      if (pan && !pan.moved) setSel(null);
      pan = null;
    };
    // A scroll that takes over a touch ends it without a tap.
    const cancel = () => {
      if (drag) { const b = bodies.get(drag.id)!; b.ox = 0; b.oy = 0; }
      drag = null; pan = null;
    };
    const bgDown = (e: PointerEvent) => { if (e.button === 0 && !drag && !column && !pinch) pan = { sx: e.clientX, sy: e.clientY, px: cam.px, py: cam.py, moved: false }; };
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", cancel);
    svg.addEventListener("pointerdown", bgDown);

    // A trackpad pinch arrives as a wheel with Ctrl held, as does Ctrl or Cmd with a mouse wheel; a plain wheel scrolls the page.
    const wheel = (e: WheelEvent) => {
      if (column || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomTo(cam.ts * Math.exp(-Math.max(-30, Math.min(30, e.deltaY)) * 0.01), e.clientX, e.clientY);
    };
    // Double-clicking the open sea zooms in there.
    const dbl = (e: MouseEvent) => {
      if (column || (e.target as Element).closest("[role=button]")) return;
      zoomTo(cam.ts * 1.6, e.clientX, e.clientY);
    };
    // Two fingers pinch to zoom; the second finger cancels whatever the first one started.
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { d0: number; s0: number } | null = null;
    const pair = () => { const [a, b] = [...touches.values()]; return a && b ? { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 } : null; };
    const touchDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || column) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = touches.size === 2 ? pair() : null;
      if (p) { pinch = { d0: p.d, s0: cam.s }; cancel(); }
    };
    const touchMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = pinch ? pair() : null;
      if (pinch && p) zoomTo((pinch.s0 * p.d) / pinch.d0, p.mx, p.my, true);
    };
    const touchUp = (e: PointerEvent) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
    svg.addEventListener("wheel", wheel, { passive: false });
    svg.addEventListener("dblclick", dbl);
    // Capture, so a finger that lands on a circle still counts toward a pinch.
    svg.addEventListener("pointerdown", touchDown, true);
    addEventListener("pointermove", touchMove); addEventListener("pointerup", touchUp); addEventListener("pointercancel", touchUp);
    const ro = new ResizeObserver(() => layout());
    ro.observe(svg);

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(2.5, (now - last) / 16.67); last = now;
      const t = now / 1000;
      const ck = reduce ? 1 : 1 - Math.pow(1 - 0.045, dt);
      cam.x += (cam.tx - cam.x) * ck; cam.y += (cam.ty - cam.y) * ck; cam.s += (cam.ts - cam.s) * ck;
      const { ox, oy } = origin();
      world.setAttribute("transform", `translate(${ox.toFixed(1)},${oy.toFixed(1)}) scale(${cam.s.toFixed(4)}) translate(${(-cam.x).toFixed(1)},${(-cam.y).toFixed(1)})`);
      const inv = Math.max(1, Math.min(1.5, 1 / cam.s));
      const dragged = drag?.moved ? drag.id : null;
      const dragRel = dragged ? related(dragged) : null;

      for (const n of nodes) {
        const b = bodies.get(n.id)!;
        let gx = b.tx + b.ox, gy = b.ty + b.oy;
        if (!reduce && n.id !== dragged) { gx += Math.sin(t * 0.6 + b.phase) * 3; gy += Math.cos(t * 0.5 + b.phase * 1.3) * 3; }
        if (dragged && n.id !== dragged && dragRel?.has(n.id)) { const d = bodies.get(dragged)!; gx += d.ox * 0.35; gy += d.oy * 0.35; }
        if (reduce || n.id === dragged) { b.x = gx; b.y = gy; b.vx = b.vy = 0; }
        else {
          b.vx = (b.vx + (gx - b.x) * 0.022 * dt) * Math.pow(0.86, dt);
          b.vy = (b.vy + (gy - b.y) * 0.022 * dt) * Math.pow(0.86, dt);
          b.x += b.vx * dt; b.y += b.vy * dt;
        }
        b.r += (b.tr - b.r) * (reduce ? 1 : 1 - Math.pow(1 - 0.06, dt));
        b.o += (b.to - b.o) * (reduce ? 1 : 1 - Math.pow(1 - 0.05, dt));
        const ts = hover === n.id ? 1.12 : 1;
        if (reduce) b.s = ts; else { b.sv = (b.sv + (ts - b.s) * 0.12) * 0.74; b.s += b.sv; }
        const want = hot ? (hot.has(n.id) ? 1 : 0.3) : lit ? (lit.has(n.id) ? 1 : 0.4) : 1;
        b.dim += (want - b.dim) * 0.2;
      }
      // Push overlapping circles apart.
      const vis = nodes.map((n) => [n.id, bodies.get(n.id)!] as const).filter(([, b]) => b.o > 0.05 && b.r > 4);
      for (let i = 0; i < vis.length; i++) for (let k = i + 1; k < vis.length; k++) {
        const [ia, a] = vis[i]!, [ib, c] = vis[k]!;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + c.r + 22;
        if (d < min) {
          const f = ((min - d) / d) * 0.12;
          if (ia !== dragged) { a.x -= dx * f; a.y -= dy * f; }
          if (ib !== dragged) { c.x += dx * f; c.y += dy * f; }
        }
      }

      for (const n of nodes) {
        const b = bodies.get(n.id)!, e = els.current.get(n.id);
        if (!e?.g) continue;
        const r = Math.max(0, b.r);
        e.g.setAttribute("transform", `translate(${b.x.toFixed(1)},${b.y.toFixed(1)}) scale(${b.s.toFixed(3)})`);
        e.g.style.opacity = (b.o * b.dim).toFixed(3);
        e.g.style.display = b.o < 0.01 && b.to === 0 ? "none" : "";
        e.body?.setAttribute("r", r.toFixed(1));
        e.ring?.setAttribute("r", (r + (n.type === "company" ? 10 : 6)).toFixed(1));
        e.halo?.setAttribute("r", (r + 16).toFixed(1));
        if (n.type === "company") {
          // The business's initial fills its circle, the way the business switcher shows it; the name sits below
          if (e.inner) { e.inner.style.fontSize = `${(r * 0.95).toFixed(1)}px`; e.inner.setAttribute("y", (r * 0.33).toFixed(1)); e.inner.style.display = r > 12 ? "" : "none"; }
        } else if (e.icon) {
          const is = (r * 0.8) / 24;
          e.icon.setAttribute("transform", `scale(${is.toFixed(3)}) translate(-12,-12)`);
          e.icon.style.display = r > 9 ? "" : "none";
        }
        if (e.badge) {
          e.badge.style.display = n.waiting > 0 && r > 8 ? "" : "none";
          e.badge.setAttribute("transform", `translate(${(r * 0.74).toFixed(1)},${(-r * 0.74).toFixed(1)}) scale(${inv.toFixed(3)})`);
        }
        const ls = (n.type === "company" ? 19 : n.type === "stage" ? 16 : 15) * inv, ss = 13 * inv, lead = (n.lines.length - 1) * ls * 1.15;
        // Baselines for the label's first line and the subline, on the side of the circle the layout picked.
        let lx = 0, ly = r + 14 + ls * 0.9, sy = ly + lead + ss * 1.3;
        if (b.label === "above") { sy = -r - 16; ly = sy - ss * 1.3 - lead; }
        else if (b.label === "left" || b.label === "right") {
          lx = b.label === "right" ? r + 12 : -r - 12;
          ly = -(lead + ss * 1.3) / 2 + ls * 0.35; sy = ly + lead + ss * 1.3;
        }
        const shown = b.o > 0.05;
        if (e.lab) {
          e.lab.style.display = shown ? "" : "none";
          e.lab.style.fontSize = `${ls}px`;
          e.lab.setAttribute("transform", `translate(${lx.toFixed(1)},${ly.toFixed(1)})`);
        }
        if (e.sub) {
          e.sub.style.display = shown ? "" : "none";
          e.sub.style.fontSize = `${ss}px`;
          e.sub.setAttribute("transform", `translate(${lx.toFixed(1)},${sy.toFixed(1)})`);
        }
        if (e.link && n.parent) {
          const p = bodies.get(n.parent)!;
          const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
          const a0 = p.r * p.s + 8, a1 = b.r * b.s + 8;
          const show = b.o > 0.02 && p.o > 0.02 && (column || d > a0 + a1);
          // In a column the wire drops from the stage and turns into the job; on the ring it runs straight.
          const path = column
            ? `M${p.x.toFixed(1)},${(p.y + p.r * p.s + 6).toFixed(1)}V${b.y.toFixed(1)}H${(b.x - a1).toFixed(1)}`
            : `M${(p.x + ux * a0).toFixed(1)},${(p.y + uy * a0).toFixed(1)}L${(b.x - ux * a1).toFixed(1)},${(b.y - uy * a1).toFixed(1)}`;
          e.link.style.display = show ? "" : "none";
          if (show) e.link.setAttribute("d", path);
          const lineLit = !!hot && hot.has(n.id) && hot.has(n.parent) && (hover === n.id || hover === n.parent);
          e.link.classList.toggle(styles.linkHot ?? "linkHot", lineLit);
          const o = Math.min(b.o, p.o) * Math.min(b.dim, p.dim);
          e.link.style.opacity = o.toFixed(3);
          if (e.trail) {
            e.trail.style.display = show && n.waiting > 0 ? "" : "none";
            if (show && n.waiting > 0) { e.trail.setAttribute("d", path); e.trail.style.opacity = (o * 0.9).toFixed(3); }
          }
        }
      }
      if (hover && tipRef.current && !tipRef.current.hidden) {
        const b = bodies.get(hover)!, tip = tipRef.current;
        const sx = ox + (b.x - cam.x) * cam.s, sy = oy + (b.y - cam.y - b.r * b.s - 12) * cam.s;
        const below = sy < 120;
        tip.style.left = `${Math.max(140, Math.min(vp.w - 140, sx))}px`;
        tip.style.top = `${below ? oy + (b.y - cam.y + b.r * b.s + 62) * cam.s : sy}px`;
        tip.dataset.below = below ? "true" : "false";
      }
      raf = requestAnimationFrame(frame);
    };

    layout();
    for (const b of bodies.values()) { b.x = 0; b.y = 0; b.r = 0; b.o = 0; }
    cam.x = cam.tx; cam.y = cam.ty; cam.s = cam.ts;
    raf = requestAnimationFrame((now) => { frame(now); svg.dataset.ready = "true"; });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", cancel);
      svg.removeEventListener("pointerdown", bgDown);
      svg.removeEventListener("wheel", wheel); svg.removeEventListener("dblclick", dbl); svg.removeEventListener("pointerdown", touchDown, true);
      removeEventListener("pointermove", touchMove); removeEventListener("pointerup", touchUp); removeEventListener("pointercancel", touchUp);
      cleanups.forEach((c) => c());
    };
  }, [nodes, byId, children, stages]);

  const jobs = stages.flatMap((stage) => stage.jobs.map((job) => ({ stage, job })));
  const waiting = jobs.flatMap(({ job }) => job.automations.filter((a) => a.waiting > 0).map((auto) => ({ job, auto })));
  const extra = Math.max(0, pendingTotal - waiting.reduce((n, { auto }) => n + auto.waiting, 0));
  const kinds = KINDS.filter((k) => jobs.some(({ job }) => job.kind === k));
  const selStage = sel?.type === "stage" ? stages.find((s) => s.id === sel.id) : undefined;
  const selJob = sel?.type === "job" ? jobs.find(({ job }) => job.id === sel.id) : undefined;

  return (
    <section className={styles.map} aria-labelledby="map-title">
      <h2 id="map-title" className="sr">Map of every job</h2>
      {waiting.length > 0 || extra > 0 ? (
        <div className={styles.needs}>
          <h3 className={styles.needsTitle}>Waiting for your OK</h3>
          <ul className={styles.needsList}>
            {waiting.map(({ job, auto }) => (
              <li key={`${job.id}:${auto.key}`}>
                <Link href={auto.reviewHref ?? auto.href} className={styles.need} aria-label={`Review ${plural(auto.waiting, "draft")} from ${auto.name}`}>
                  <b className={styles.count} aria-hidden="true">{auto.waiting}</b>
                  <span className={styles.needText}><b>{auto.name}</b><span>{job.name}</span></span>
                  <span className={styles.go} aria-hidden="true">Review <ArrowRight size={14} /></span>
                </Link>
              </li>
            ))}
            {extra > 0 && (
              <li>
                <Link href={approvalsHref} className={styles.need}>
                  <b className={styles.count} aria-hidden="true">{extra}</b>
                  <span className={styles.needText}><b>{plural(extra, waiting.length > 0 ? "more draft" : "draft")} in Approvals</b><span>From work outside these jobs</span></span>
                  <span className={styles.go} aria-hidden="true">Review <ArrowRight size={14} /></span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <p className={styles.hint}>Nothing waits for your OK right now.</p>
      )}
      <p className={styles.hint}>Tap any job to see what it does and change who handles it.</p>

      <div className={styles.stage} ref={wrapRef} data-panel={sel ? "open" : "closed"}>
        <div className={styles.chart} ref={chartRef}>
          <svg ref={svgRef} className={styles.svg} role="group" aria-label={`Map of ${businessName}'s jobs`}>
            <g ref={worldRef}>
              <g>
                {nodes.filter((n) => n.parent !== null).map((n) => (
                  <path key={n.id} ref={refFor(n.id, "trail")} className={styles.trail} style={{ display: "none" }} />
                ))}
              </g>
              <g>
                {nodes.filter((n) => n.parent !== null).map((n) => (
                  <path key={n.id} ref={refFor(n.id, "link")} className={styles.link} data-dash={n.kind === "none" ? "true" : undefined} />
                ))}
              </g>
              <g>
                {nodes.map((n) => {
                  const Icon = n.icon;
                  return (
                    <g key={n.id} ref={refFor(n.id, "g")} className={styles.node} data-type={n.type} data-kind={n.kind ?? undefined} data-wait={n.waiting > 0 ? "true" : undefined}
                      role="button" tabIndex={0} aria-label={`${n.label}. ${n.sub}`}>
                      <circle ref={refFor(n.id, "halo")} className={styles.halo} r={0} />
                      <circle ref={refFor(n.id, "ring")} className={styles.ring} r={0} />
                      <circle ref={refFor(n.id, "body")} className={styles.body} r={0} />
                      {n.type === "company" ? (
                        <text ref={refFor(n.id, "inner")} className={styles.hqName} aria-hidden="true">{n.label.trim().charAt(0).toUpperCase()}</text>
                      ) : (
                        Icon && <g ref={refFor(n.id, "icon")} className={styles.icon}><Icon width={24} height={24} strokeWidth={1.7} /></g>
                      )}
                      <text ref={refFor(n.id, "lab")} className={styles.label}>
                        {n.lines.map((line, i) => <tspan key={i} x={0} dy={i === 0 ? 0 : "1.15em"}>{line}</tspan>)}
                      </text>
                      <text ref={refFor(n.id, "sub")} className={styles.sub} data-wait={n.waiting > 0 ? "true" : undefined}>{n.sub}</text>
                      {n.waiting > 0 && (
                        <g ref={refFor(n.id, "badge")} className={styles.badge} style={{ display: "none" }}>
                          <circle r={14} />
                          <text>{n.waiting}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
          <div ref={tipRef} className={styles.tip} hidden />
          <div className={styles.zoom} role="group" aria-label="Zoom the map">
            <button type="button" aria-label="Zoom in" title="Zoom in. You can also pinch, or hold Ctrl and scroll." onClick={() => zoomRef.current.by(1.3)}><Plus aria-hidden="true" size={18} /></button>
            <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomRef.current.by(1 / 1.3)}><Minus aria-hidden="true" size={18} /></button>
            <button type="button" aria-label="Show the whole map" title="Show the whole map" onClick={() => zoomRef.current.fit()}><Maximize2 aria-hidden="true" size={16} /></button>
          </div>
        </div>
        <ul className={styles.legend} aria-label="What the colors mean">
          {kinds.map((k) => <li key={k}><i className={styles.dot} data-kind={k} />{KEY[k]}</li>)}
          {waiting.length > 0 && <li><i className={styles.dot} data-wait="true" />Has a draft for your OK</li>}
        </ul>
        <aside ref={panelRef} className={styles.panel} aria-label="Details" hidden={sel === null}>
          <button type="button" className={styles.panelX} aria-label="Close details" onClick={() => setSel(null)}><X aria-hidden="true" size={18} /></button>
          {selStage && (
            <>
              <p className={styles.eyebrow}>Part of your day</p>
              <h3 className={styles.panelTitle}>{selStage.name}</h3>
              <p className={styles.lede}>{selStage.blurb}.</p>
              <ul className={styles.rows}>
                {selStage.jobs.map((job) => {
                  const jw = waitingOf([job]);
                  return (
                    <li key={job.id}>
                      <button type="button" className={styles.row} onClick={() => setSel({ type: "job", id: job.id })}>
                        <span className={styles.rowHead}><b>{job.name}</b>{jw > 0 && <span className={styles.wait}>{plural(jw, "draft")} for your OK</span>}</span>
                        <span className={styles.who}><i className={styles.dot} data-kind={job.kind} /><span><b>{job.handler}</b> {job.note}</span></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {/* Keyed per job, so "Change who handles this" starts closed on each one */}
          {selJob && <JobDetails key={selJob.job.id} businessId={businessId} stageName={selJob.stage.name} job={selJob.job} />}
        </aside>
      </div>
    </section>
  );
}

/** Render one job in the panel: who handles it, its drafts to review, its automations, and the way to change who handles it. */
function JobDetails({ businessId, stageName, job }: { readonly businessId: string; readonly stageName: string; readonly job: MapJob }) {
  const jw = waitingOf([job]);
  const review = job.automations.find((a) => a.reviewHref !== null)?.reviewHref ?? null;
  return (
    <>
      <p className={styles.eyebrow}>{stageName}</p>
      <h3 className={styles.panelTitle}>{job.name}</h3>
      <p className={styles.who}><i className={styles.dot} data-kind={job.kind} /><span><b>{job.handler}</b> {job.note}</span></p>
      {jw > 0 && review !== null && (
        <Link href={review} className="btn">Review {plural(jw, "draft")} <ArrowRight aria-hidden="true" size={16} /></Link>
      )}
      <h4 className={styles.eyebrow}>What happens in this job</h4>
      <ul className={styles.rows}>
        {job.automations.map((a) => (
          <li key={a.key}>
            <Link href={a.href} className={styles.row}>
              <span className={styles.rowHead}><b>{a.name}</b>{a.waiting > 0 && <span className={styles.wait}>{plural(a.waiting, "draft")} for your OK</span>}</span>
              <span className={styles.lede}>{a.summary}</span>
              <span className={styles.go}>Open <ArrowRight aria-hidden="true" size={14} /></span>
            </Link>
          </li>
        ))}
      </ul>
      <ChangeHandler businessId={businessId} name={job.name} options={job.options} compareHref={job.compareHref} />
    </>
  );
}
