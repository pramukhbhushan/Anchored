"use client";

import { Sheet } from "@/components/ui/Sheet";
import inspection from "@/components/ui/inspection.module.css";

import { ArrowLeft, ArrowRight, CalendarCheck, CircleDashed, CircleDollarSign, MessageSquareText, Users, Wrench, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { workflowIcon } from "@/components/business/workflow-icons";
import type { HandlerKind } from "@/components/workflows/flow";
import styles from "@/components/workflows/map.module.css";
import type { StageId } from "@/lib/domain/stages";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The Workflows map: the business in the middle, the three parts of its day
// around it, the jobs inside each part, and the automations inside each job.
// One level shows at a time, so an owner never faces more than a few circles.
// A guide above it names where they are with a big title and a three-step
// progress bar. Tapping an automation opens a short overview that links to the
// automation's own page. React renders every circle once; a small spring
// engine in `useEffect` moves them, so hovering pops a circle and the rest
// drift and settle like a graph view. Reduced motion places them still.

/** One automation on the map, told in the owner's words. */
export interface MapAutomation {
  readonly key: string;
  readonly name: string;
  readonly summary: string;
  readonly handler: string;
  readonly result: string | null;
  /** Drafts waiting for the owner's OK. */
  readonly waiting: number;
  readonly href: string;
}

/** One job on the map and its automations. */
export interface MapJob {
  readonly id: WorkflowId;
  readonly name: string;
  readonly kind: HandlerKind;
  readonly handler: string;
  readonly note: string;
  readonly automations: readonly MapAutomation[];
}

/** One part of the day on the map and its jobs. */
export interface MapStage {
  readonly id: StageId;
  readonly name: string;
  readonly blurb: string;
  readonly jobs: readonly MapJob[];
}

type View = { readonly level: 0 } | { readonly level: 1; readonly stage: StageId } | { readonly level: 2; readonly stage: StageId; readonly job: WorkflowId };

type NodeType = "company" | "stage" | "job" | "auto";

interface MapNode {
  readonly id: string;
  readonly type: NodeType;
  readonly parent: string | null;
  readonly label: string;
  readonly sub: string;
  readonly wait: boolean;
  readonly tip: string;
  readonly kind: HandlerKind | null;
  readonly icon: LucideIcon | null;
  /** The ring's color token. */
  readonly ring: string;
  readonly stage?: MapStage;
  readonly job?: MapJob;
  readonly auto?: MapAutomation;
}

/** Live position and motion for one circle; the engine mutates it every frame. */
interface Body {
  x: number; y: number; vx: number; vy: number;
  r: number; tr: number; tx: number; ty: number;
  o: number; to: number; s: number; sv: number;
  dim: number; phase: number; lab: boolean; ox: number; oy: number;
}

const STAGE_ICON: Readonly<Record<StageId, LucideIcon>> = { customers: Users, serving: CalendarCheck, running: CircleDollarSign };
const STAGE_RING: Readonly<Record<StageId, string>> = { customers: "var(--ocean)", serving: "var(--lagoon)", running: "var(--good)" };
const KIND_RING: Readonly<Record<HandlerKind, string>> = { agent: "var(--ocean)", owned: "var(--coral)", new: "var(--coral)", none: "transparent" };
const AUTO_ICON: Readonly<Record<HandlerKind, LucideIcon>> = { agent: MessageSquareText, owned: Wrench, new: Wrench, none: CircleDashed };
const STEPS = ["Pick a part", "Pick a job", "Watch it work"] as const;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const waitingOf = (jobs: readonly MapJob[]) => jobs.reduce((sum, j) => sum + j.automations.reduce((s, a) => s + a.waiting, 0), 0);

/** Lay the business, its stages, jobs and automations out as one tree of circles. */
function nodesOf(businessName: string, stages: readonly MapStage[]): MapNode[] {
  const jobCount = stages.reduce((n, s) => n + s.jobs.length, 0);
  const out: MapNode[] = [
    { id: "hq", type: "company", parent: null, label: businessName, sub: plural(jobCount, "job"), wait: false, kind: null, icon: null, ring: "var(--ink)",
      tip: "This is your business. Everything Anchored does for you connects back here." },
  ];
  for (const stage of stages) {
    const w = waitingOf(stage.jobs);
    out.push({ id: `s:${stage.id}`, type: "stage", parent: "hq", label: stage.name, sub: plural(stage.jobs.length, "job") + (w > 0 ? ` · ${w} need${w === 1 ? "s" : ""} your OK` : ""),
      wait: false, kind: null, icon: STAGE_ICON[stage.id], ring: STAGE_RING[stage.id], stage, tip: `${stage.blurb}. Tap to see the jobs in this part.` });
    for (const job of stage.jobs) {
      const jw = waitingOf([job]);
      out.push({ id: `j:${job.id}`, type: "job", parent: `s:${stage.id}`, label: job.name, sub: jw > 0 ? "Needs your OK" : job.handler, wait: jw > 0, kind: job.kind,
        icon: workflowIcon(job.id), ring: jw > 0 ? "var(--carbon)" : KIND_RING[job.kind], stage, job,
        tip: job.kind === "agent" ? "Anchored writes the messages for this job. Nothing goes out until you approve it."
          : job.kind === "none" ? "Nobody handles this yet, so you do it yourself."
          : `${job.handler} does this job. ${job.note}.` });
      for (const auto of job.automations) {
        out.push({ id: `a:${job.id}:${auto.key}`, type: "auto", parent: `j:${job.id}`, label: auto.name,
          sub: auto.waiting > 0 ? "Needs your OK" : job.kind === "none" ? "Not set up yet" : job.kind === "agent" ? "Anchored does it" : auto.handler,
          wait: auto.waiting > 0, kind: job.kind, icon: AUTO_ICON[job.kind], ring: auto.waiting > 0 ? "var(--carbon)" : KIND_RING[job.kind], stage, job, auto,
          tip: `${auto.summary} Tap for a quick overview.` });
      }
    }
  }
  return out;
}

const rad = (d: number) => (d * Math.PI) / 180;
const polar = (x: number, y: number, r: number, deg: number): [number, number] => [x + r * Math.cos(rad(deg)), y + r * Math.sin(rad(deg))];

/** Angles for `n` children of the circle in the middle: side by side when wide, below when narrow. */
function childAngles(n: number, portrait: boolean): number[] {
  if (n === 1) return [portrait ? 90 : 0];
  if (n === 2) return portrait ? [58, 122] : [180, 0];
  return Array.from({ length: n }, (_, k) => (k * 360) / n - 90);
}

/** Render the map for `businessName` and its `stages`. */
export function WorkflowMap({ businessName, stages }: { readonly businessName: string; readonly stages: readonly MapStage[] }) {
  const nodes = useMemo(() => nodesOf(businessName, stages), [businessName, stages]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const children = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) if (n.parent !== null) m.set(n.parent, [...(m.get(n.parent) ?? []), n.id]);
    return m;
  }, [nodes]);

  const [view, setView] = useState<View>({ level: 0 });
  const [peek, setPeek] = useState<MapNode | null>(null);
  const [title, setTitle] = useState("Your business");
  const [swap, setSwap] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const panelOpen = view.level > 0;
  const wrapRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, { g: SVGGElement | null; body: SVGCircleElement | null; ring: SVGCircleElement | null; lab: SVGTextElement | null; sub: SVGTextElement | null; icon: SVGGElement | null; link: SVGLineElement | null; inner: SVGTextElement | null; innerSub: SVGTextElement | null }>());
  const viewRef = useRef<View>(view);
  const activateRef = useRef<(id: string) => void>(() => {});
  const relayout = useRef<() => void>(() => {});

  const refFor = (id: string, part: "g" | "body" | "ring" | "lab" | "sub" | "icon" | "link" | "inner" | "innerSub") => (el: SVGElement | null) => {
    const entry = els.current.get(id) ?? { g: null, body: null, ring: null, lab: null, sub: null, icon: null, link: null, inner: null, innerSub: null };
    (entry as Record<string, SVGElement | null>)[part] = el;
    els.current.set(id, entry);
  };

  const go = useCallback((v: View) => {
    setPeek(null);
    setView(v);
  }, []);

  activateRef.current = (id: string) => {
    const n = byId.get(id);
    if (!n) return;
    if (n.type === "company") go({ level: 0 });
    else if (n.type === "stage" && n.stage) go({ level: 1, stage: n.stage.id });
    else if (n.type === "job" && n.stage && n.job) go({ level: 2, stage: n.stage.id, job: n.job.id });
    else if (n.type === "auto") setPeek(n);
  };

  // The guide's title fades out, changes, and fades back in.
  const nextTitle = view.level === 0 ? "Your business" : view.level === 1 ? (byId.get(`s:${view.stage}`)?.label ?? "") : (byId.get(`j:${view.job}`)?.label ?? "");
  useEffect(() => {
    if (nextTitle === title) return;
    setSwap(true);
    const t = setTimeout(() => { setTitle(nextTitle); setSwap(false); }, 280);
    return () => clearTimeout(t);
  }, [nextTitle, title]);

  useEffect(() => {
    viewRef.current = view;
    relayout.current();
  }, [view]);

  // Esc steps back up one level, or closes the overview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (peek) return;
      const v = viewRef.current;
      if (v.level === 2) go({ level: 1, stage: v.stage });
      else if (v.level === 1) go({ level: 0 });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [peek, go]);

  // ---------------------------------------------------------------- the engine
  useEffect(() => {
    const svg = svgRef.current, world = worldRef.current;
    if (!svg || !world) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bodies = new Map<string, Body>(nodes.map((n) => [n.id, { x: 0, y: 0, vx: 0, vy: 0, r: 0, tr: 0, tx: 0, ty: 0, o: 0, to: 0, s: 1, sv: 0, dim: 1, phase: Math.random() * 6.28, lab: false, ox: 0, oy: 0 }]));
    const cam = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1, px: 0, py: 0 };
    let vp = { w: 800, h: 600, panel: 0 };
    let hover: string | null = null;
    let hot: Set<string> | null = null;
    let drag: { id: string; sx: number; sy: number; dx: number; dy: number; moved: boolean } | null = null;
    let pan: { sx: number; sy: number; px: number; py: number } | null = null;
    let raf = 0;

    const related = (id: string) => new Set([id, byId.get(id)?.parent ?? "", ...(children.get(id) ?? [])].filter(Boolean));

    const measure = () => {
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const panel = wrapRef.current?.dataset.panel === "open" && innerWidth > 760 ? Math.min(360, r.width * 0.4) + 24 : 0;
      vp = { w: r.width, h: r.height, panel };
    };

    const place = (id: string, xy: [number, number], r: number) => {
      const b = bodies.get(id);
      if (!b) return;
      b.tx = xy[0]; b.ty = xy[1]; b.tr = r; b.to = 1; b.lab = true;
    };

    const layout = () => {
      measure();
      for (const b of bodies.values()) b.to = -1;
      const v = viewRef.current;
      const portrait = vp.w - vp.panel < vp.h * 0.92;
      if (v.level === 0) {
        place("hq", [0, 0], 78);
        const ang = [-90, 30, 150];
        stages.forEach((s, i) => place(`s:${s.id}`, polar(0, 0, 260, (ang[i % 3] ?? 0) + Math.floor(i / 3) * 60), 58));
      } else if (v.level === 1) {
        place(`s:${v.stage}`, [0, 0], 68);
        const jobs = children.get(`s:${v.stage}`) ?? [];
        const a = childAngles(jobs.length, portrait);
        jobs.forEach((id, k) => place(id, polar(0, 0, jobs.length > 3 ? 250 : 230, a[k] ?? 0), jobs.length > 4 ? 48 : 58));
      } else {
        place(`j:${v.job}`, [0, 0], 62);
        const autos = children.get(`j:${v.job}`) ?? [];
        const a = childAngles(autos.length, portrait);
        autos.forEach((id, k) => place(id, polar(0, 0, 220, a[k] ?? 0), 52));
      }
      // Circles not on this level fold into their parent.
      for (const n of nodes) {
        const b = bodies.get(n.id)!;
        if (b.to === 1) continue;
        const p = n.parent ? bodies.get(n.parent) : undefined;
        b.tx = p ? p.tx : 0; b.ty = p ? p.ty : 0; b.tr = 0; b.to = 0; b.lab = false;
      }
      for (const n of nodes) {
        const g = els.current.get(n.id)?.g;
        if (!g) continue;
        const on = bodies.get(n.id)!.to > 0;
        g.style.pointerEvents = on ? "auto" : "none";
        g.setAttribute("tabindex", on ? "0" : "-1");
        g.setAttribute("aria-hidden", on ? "false" : "true");
      }
      // Fit the camera to what shows.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of bodies.values()) {
        if (b.to <= 0) continue;
        x0 = Math.min(x0, b.tx - b.tr - 90); x1 = Math.max(x1, b.tx + b.tr + 90);
        y0 = Math.min(y0, b.ty - b.tr - 14); y1 = Math.max(y1, b.ty + b.tr + 56);
      }
      cam.ts = Math.max(0.4, Math.min(1.25, (vp.w - vp.panel - 32) / (x1 - x0), (vp.h - 60) / (y1 - y0)));
      cam.tx = (x0 + x1) / 2; cam.ty = (y0 + y1) / 2; cam.px = 0; cam.py = 0;
      const f = bodies.get(v.level === 2 ? `j:${v.job}` : v.level === 1 ? `s:${v.stage}` : "hq");
      if (f) f.sv += 0.09;
    };
    relayout.current = () => requestAnimationFrame(layout);

    const origin = () => ({ ox: (vp.w - vp.panel) / 2 + cam.px, oy: vp.h / 2 + cam.py });
    const toWorld = (cx: number, cy: number): [number, number] => {
      const r = svg.getBoundingClientRect(), { ox, oy } = origin();
      return [(cx - r.left - ox) / cam.s + cam.x, (cy - r.top - oy) / cam.s + cam.y];
    };

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
        if (e.button !== 0) return;
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
      } else if (pan) { cam.px = pan.px + (e.clientX - pan.sx); cam.py = pan.py + (e.clientY - pan.sy); }
    };
    const up = () => {
      if (drag) {
        const b = bodies.get(drag.id)!;
        if (!drag.moved) activateRef.current(drag.id);
        b.ox = 0; b.oy = 0; drag = null;
      }
      pan = null;
    };
    const bgDown = (e: PointerEvent) => { if (e.button === 0 && !drag) pan = { sx: e.clientX, sy: e.clientY, px: cam.px, py: cam.py }; };
    addEventListener("pointermove", move); addEventListener("pointerup", up); svg.addEventListener("pointerdown", bgDown);
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
      const inv = Math.max(1, Math.min(1.9, 1 / cam.s));
      const dragged = drag?.moved ? drag.id : null;
      const dragRel = dragged ? related(dragged) : null;

      for (const n of nodes) {
        const b = bodies.get(n.id)!;
        let gx = b.tx + b.ox, gy = b.ty + b.oy;
        if (!reduce && n.id !== dragged) { gx += Math.sin(t * 0.6 + b.phase) * 3.5; gy += Math.cos(t * 0.5 + b.phase * 1.3) * 3.5; }
        if (dragged && n.id !== dragged && dragRel?.has(n.id)) { const d = bodies.get(dragged)!; gx += d.ox * 0.35; gy += d.oy * 0.35; }
        if (reduce || n.id === dragged) { b.x = gx; b.y = gy; b.vx = b.vy = 0; }
        else {
          b.vx = (b.vx + (gx - b.x) * 0.022 * dt) * Math.pow(0.86, dt);
          b.vy = (b.vy + (gy - b.y) * 0.022 * dt) * Math.pow(0.86, dt);
          b.x += b.vx * dt; b.y += b.vy * dt;
        }
        b.r += (b.tr - b.r) * (reduce ? 1 : 1 - Math.pow(1 - 0.06, dt));
        b.o += (b.to - b.o) * (reduce ? 1 : 1 - Math.pow(1 - 0.05, dt));
        const ts = hover === n.id ? 1.14 : 1;
        if (reduce) b.s = ts; else { b.sv = (b.sv + (ts - b.s) * 0.12) * 0.74; b.s += b.sv; }
        b.dim += ((hot && !hot.has(n.id) ? 0.3 : 1) - b.dim) * 0.2;
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
        e.ring?.setAttribute("r", (r + (n.type === "company" ? 10 : n.type === "auto" ? 4 : 6)).toFixed(1));
        if (n.type === "company") {
          // Shrink a long business name so it fits across the circle (Archivo at 116% runs about 0.62em a letter)
          const fs = Math.max(10, Math.min(r * 0.24, (r * 1.6) / (Math.max(1, n.label.length) * 0.62)));
          const big = r > 60;
          if (e.inner) { e.inner.style.fontSize = `${fs}px`; e.inner.setAttribute("y", (fs * 0.15).toFixed(1)); e.inner.style.display = big ? "" : "none"; }
          if (e.innerSub) { e.innerSub.style.fontSize = `${Math.max(8, r * 0.15)}px`; e.innerSub.setAttribute("y", (fs * 0.15 + r * 0.3).toFixed(1)); e.innerSub.style.display = big ? "" : "none"; }
        } else if (e.icon) {
          const is = (r * 0.8) / 24;
          e.icon.setAttribute("transform", `scale(${is.toFixed(3)}) translate(-12,-12)`);
          e.icon.style.display = r > 9 ? "" : "none";
        }
        const ls = (n.type === "auto" ? 14 : 15) * inv, ss = 13 * inv;
        if (e.lab) {
          e.lab.style.display = b.lab && (n.type !== "company" || r <= 60) ? "" : "none";
          e.lab.style.fontSize = `${ls}px`;
          e.lab.setAttribute("y", (r + 14 + ls * 0.9).toFixed(1));
        }
        if (e.sub) {
          e.sub.style.display = b.lab && n.type !== "company" ? "" : "none";
          e.sub.style.fontSize = `${ss}px`;
          e.sub.setAttribute("y", (r + 18 + ls * 0.9 + ss * 1.25).toFixed(1));
        }
        if (e.link && n.parent) {
          const p = bodies.get(n.parent)!;
          const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
          const a0 = p.r * p.s + 8, a1 = b.r * b.s + 8;
          const show = d > a0 + a1 && b.o > 0.02 && p.o > 0.02;
          e.link.style.display = show ? "" : "none";
          if (show) {
            e.link.setAttribute("x1", (p.x + ux * a0).toFixed(1)); e.link.setAttribute("y1", (p.y + uy * a0).toFixed(1));
            e.link.setAttribute("x2", (b.x - ux * a1).toFixed(1)); e.link.setAttribute("y2", (b.y - uy * a1).toFixed(1));
          }
          const lit = !!hot && hot.has(n.id) && hot.has(n.parent) && (hover === n.id || hover === n.parent);
          e.link.classList.toggle(styles.linkHot ?? "linkHot", lit);
          e.link.style.opacity = (Math.min(b.o, p.o) * Math.min(b.dim, p.dim) * (lit ? 1 : 0.55)).toFixed(3);
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
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); svg.removeEventListener("pointerdown", bgDown);
      cleanups.forEach((c) => c());
    };
  }, [nodes, byId, children, stages]);

  const back = () => {
    if (view.level === 2) go({ level: 1, stage: view.stage });
    else if (view.level === 1) go({ level: 0 });
  };
  const hint = view.level === 0 ? "Tap one of the parts of your day around your business."
    : view.level === 1 ? "Tap a job to see what Anchored does for you there."
    : "Tap a circle for a quick overview, then open it to use it.";
  const stageNode = view.level === 0 ? undefined : byId.get(`s:${view.stage}`);
  const jobNode = view.level === 2 ? byId.get(`j:${view.job}`) : undefined;

  return (
    <section className={styles.map} aria-labelledby="map-title">
      <div className={styles.guide}>
        <nav className={styles.crumbs} aria-label="Where you are on the map">
          {view.level > 0 && (
            <button type="button" className={styles.back} onClick={back}>
              <ArrowLeft aria-hidden="true" size={16} /> Back
            </button>
          )}
          <button type="button" onClick={() => go({ level: 0 })} aria-current={view.level === 0 ? "step" : undefined}>{businessName}</button>
          {stageNode?.stage && (
            <>
              <span aria-hidden="true">›</span>
              <button type="button" onClick={() => go({ level: 1, stage: stageNode.stage!.id })} aria-current={view.level === 1 ? "step" : undefined}>{stageNode.label}</button>
            </>
          )}
          {jobNode && (
            <>
              <span aria-hidden="true">›</span>
              <button type="button" aria-current="step">{jobNode.label}</button>
            </>
          )}
        </nav>
        <ol className={styles.progress} aria-label="Progress">
          {STEPS.map((step, i) => (
            <li key={step} data-state={i < view.level ? "done" : i === view.level ? "now" : "next"} aria-current={i === view.level ? "step" : undefined}>
              <span><b>Step {i + 1}</b>{step}</span>
              <span className={styles.bar}><i /></span>
            </li>
          ))}
        </ol>
        <h2 id="map-title" className={styles.title} data-swap={swap ? "true" : "false"}>{title}</h2>
        <p className={styles.hint}>{hint}</p>
      </div>

      <div className={styles.stage} ref={wrapRef} data-panel={panelOpen ? "open" : "closed"}>
        <div className={styles.chart}>
          <svg ref={svgRef} className={styles.svg} role="group" aria-label={`Map of ${businessName}'s workflows`}>
            <g ref={worldRef}>
              <g>
                {nodes.filter((n) => n.parent !== null).map((n) => (
                  <line key={n.id} ref={refFor(n.id, "link")} className={styles.link} data-dash={n.kind === "none" ? "true" : undefined} />
                ))}
              </g>
              <g>
                {nodes.map((n) => {
                  const Icon = n.icon;
                  return (
                    <g key={n.id} ref={refFor(n.id, "g")} className={styles.node} data-type={n.type} data-kind={n.kind ?? undefined} data-wait={n.wait ? "true" : undefined}
                      role="button" tabIndex={-1} aria-label={`${n.label}. ${n.sub}`} style={{ "--ring": n.ring } as React.CSSProperties}>
                      <circle className={styles.halo} r={0} />
                      <circle ref={refFor(n.id, "ring")} className={styles.ring} r={0} />
                      <circle ref={refFor(n.id, "body")} className={styles.body} r={0} />
                      {n.type === "company" ? (
                        <>
                          <text ref={refFor(n.id, "inner")} className={styles.hqName}>{n.label}</text>
                          <text ref={refFor(n.id, "innerSub")} className={styles.hqSub}>{n.sub}</text>
                        </>
                      ) : (
                        Icon && <g ref={refFor(n.id, "icon")} className={styles.icon}><Icon width={24} height={24} strokeWidth={1.7} /></g>
                      )}
                      <text ref={refFor(n.id, "lab")} className={styles.label}>{n.label}</text>
                      <text ref={refFor(n.id, "sub")} className={styles.sub} data-wait={n.wait ? "true" : undefined}>{n.sub}</text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
          <div ref={tipRef} className={styles.tip} hidden />
          <div className={styles.legend} aria-hidden="true">
            <span><i style={{ borderColor: "var(--ocean)" }} />Anchored does it, you approve</span>
            <span><i style={{ borderColor: "var(--coral)" }} />Another app does it</span>
            <span><i data-dash="true" />Nobody does this yet</span>
          </div>
        </div>
        <aside className={styles.panel} aria-label="Details" hidden={!panelOpen}>
          <button type="button" className={styles.panelX} aria-label="Step back" onClick={back}><X aria-hidden="true" size={18} /></button>
          {view.level === 1 && stageNode?.stage && (
            <>
              <p className={styles.eyebrow}>Part of your day</p>
              <h3 className={styles.panelTitle}>{stageNode.label}</h3>
              <p className={styles.lede}>{stageNode.stage.blurb}.</p>
              <ul className={styles.rows}>
                {stageNode.stage.jobs.map((job) => (
                  <li key={job.id}>
                    <button type="button" className={styles.row} onClick={() => go({ level: 2, stage: stageNode.stage!.id, job: job.id })}>
                      <span className={styles.rowHead}><b>{job.name}</b>{waitingOf([job]) > 0 && <span className={styles.wait}>Needs your OK</span>}</span>
                      <span className={styles.who}><i data-kind={job.kind} /><span><b>{job.handler}</b> {job.note}</span></span>
                      <span className={styles.go}>Open <ArrowRight aria-hidden="true" size={14} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {view.level === 2 && jobNode?.job && (
            <>
              <p className={styles.eyebrow}>{stageNode?.label}</p>
              <h3 className={styles.panelTitle}>{jobNode.label}</h3>
              <p className={styles.who}><i data-kind={jobNode.job.kind} /><span><b>{jobNode.job.handler}</b> {jobNode.job.note}</span></p>
              <p className={styles.eyebrow}>What happens in this job</p>
              <ul className={styles.rows}>
                {jobNode.job.automations.map((a) => (
                  <li key={a.key}>
                    <button type="button" className={styles.row} onClick={() => setPeek(byId.get(`a:${jobNode.job!.id}:${a.key}`) ?? null)}>
                      <span className={styles.rowHead}><b>{a.name}</b>{a.waiting > 0 && <span className={styles.wait}>Needs your OK</span>}</span>
                      <span className={styles.lede}>{a.summary}</span>
                      <span className={styles.go}>Quick overview <ArrowRight aria-hidden="true" size={14} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {peek?.auto && peek.job && (
        <Peek auto={peek.auto} job={peek.job} stageName={peek.stage?.name ?? ""} onClose={() => setPeek(null)} />
      )}
    </section>
  );
}

/** Render the short overview of one automation, with the link to its own page. */
function Peek({ auto, job, stageName, onClose }: { readonly auto: MapAutomation; readonly job: MapJob; readonly stageName: string; readonly onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }} title={auto.name} description={`${stageName} / ${job.name}`}>
      <p className={styles.peekLede}>{auto.summary}</p>
      {auto.waiting > 0 && <p className={styles.wait}>{auto.waiting} waiting for your OK</p>}
      <ol className={inspection.steps} aria-label="How this work moves">
        <li><div><strong>Who handles it</strong>{auto.handler}</div></li>
        {job.kind === "agent" && <li data-owner=""><div><strong>You review the draft</strong>Read the words, make any changes, then give your OK in Approvals.</div></li>}
        <li><div><strong>What this job is set up to do</strong>{auto.result ?? "Nothing yet. You do this yourself."}</div></li>
      </ol>
      <p className="fine">This is the workflow's plan. Open the job to see its drafts and recorded activity.</p>
      <Link href={auto.href} className="btn">Open {auto.name.toLowerCase()} <ArrowRight aria-hidden="true" size={16} /></Link>
    </Sheet>
  );
}
