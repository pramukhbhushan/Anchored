"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Boat } from "@/components/site/harbor/Boats";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's hero: a sticky stage where scrolling raises the tide.
// The captain's boat starts big and centered on the chart circles, rides the
// waves, then sails right and shrinks; the headline drifts away and a large
// "Anchored" wordmark settles on the waterline, so the stage is never blank.
// Waves are drawn on two canvases, one behind the boat and one in front of
// its hull. With reduced motion the waves hold still and the scene stays put.

/** One wave layer: its resting height, wavelength, speed, phase and amplitude. */
interface Wave {
  readonly base: number;
  readonly len: number;
  readonly sp: number;
  readonly ph: number;
  readonly amp: number;
}

/** Return the wave's height at `x` and time `t` seconds. */
export function waveY(x: number, t: number, w: Wave): number {
  return w.base + Math.sin(x / w.len + t * w.sp + w.ph) * w.amp + Math.sin(x / (w.len * 0.47) - t * w.sp * 1.3 + w.ph * 2) * w.amp * 0.45;
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Render the hero scene; `children` is the headline block on the left. */
export function HarborHero({ children }: { readonly children: ReactNode }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const boatRef = useRef<HTMLDivElement>(null);
  const bigRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const knotsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scene = sceneRef.current, stage = stageRef.current, back = backRef.current, front = frontRef.current;
    const boat = boatRef.current, big = bigRef.current, copy = copyRef.current, knots = knotsRef.current;
    if (!scene || !stage || !back || !front || !boat || !big || !copy || !knots) return;
    const bctx = back.getContext("2d"), fctx = front.getContext("2d");
    if (!bctx || !fctx) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let W = 0, H = 0, raf = 0;
    let colors = { ocean: "", lagoon: "", deep: "", foam: "" };

    const readColors = () => {
      const cs = getComputedStyle(stage);
      colors = { ocean: cs.getPropertyValue("--ocean").trim(), lagoon: cs.getPropertyValue("--lagoon").trim(), deep: cs.getPropertyValue("--deep").trim(), foam: cs.getPropertyValue("--foam").trim() };
    };
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = stage.clientWidth;
      H = stage.clientHeight;
      for (const c of [back, front]) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const fillWave = (ctx: CanvasRenderingContext2D, w: Wave, t: number, color: string, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, waveY(x, t, w));
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    const crest = (ctx: CanvasRenderingContext2D, w: Wave, t: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let x = 0; x <= W + 8; x += 8) {
        const y = waveY(x, t, w);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      const still = reduce.matches;
      const t = still ? 0 : now / 1000;
      const r = scene.getBoundingClientRect();
      const p = still ? 0 : clamp01(-r.top / Math.max(1, r.height - H));
      const e = ease(p);
      const narrow = W < 760;
      const bw = boat.offsetWidth, bh = (bw * 420) / 640;

      // The boat starts centered on the chart circles; the water sits under it, never over the headline.
      let level: number;
      if (narrow) level = H * (1 - (0.1 + 0.32 * e));
      else {
        const ringY = H * 0.04 + (W * 0.7 * 300) / 800;
        const l0 = Math.max(ringY + bh * 0.36, copy.offsetHeight + 28);
        level = l0 + (Math.min(l0, H * 0.57) - l0) * e;
      }
      const amp = narrow ? 8 : 12;
      const w1: Wave = { base: level - 26, len: 120, sp: 0.6, ph: 0, amp: amp * 0.8 };
      const w2: Wave = { base: level - 10, len: 170, sp: 0.45, ph: 2, amp };
      const w3: Wave = { base: level + 8, len: 90, sp: 0.8, ph: 4, amp: amp * 0.7 };

      bctx.clearRect(0, 0, W, H);
      fctx.clearRect(0, 0, W, H);
      fillWave(bctx, w1, t, colors.lagoon, 0.55);
      fillWave(bctx, w2, t, colors.ocean, 0.85);

      const c0 = narrow ? W * 0.5 : W * 0.715, c1 = narrow ? W * 0.72 : W * 0.9;
      const cx = c0 + (c1 - c0) * e;
      const sc = 1 - (narrow ? 0.6 : 0.7) * e;
      const tilt = still ? 0 : Math.cos(cx / 170 + t * 0.45 + 2) * 2.2;
      boat.style.transform = `translate(${cx - bw / 2}px,${waveY(cx, t, w2) - bh * 0.86}px) scale(${sc}) rotate(${tilt}deg)`;

      fillWave(fctx, w3, t, colors.deep, 0.92);
      crest(fctx, w3, t, colors.foam);

      const co = Math.max(0, 1 - p * 2.6);
      copy.style.opacity = String(co);
      copy.style.transform = `translateY(${-p * 90}px)`;
      copy.style.visibility = co <= 0 ? "hidden" : "visible";
      boat.style.opacity = narrow ? String(Math.min(1, (1 - co) * 1.5)) : "1";

      const bo = clamp01((p - 0.38) / 0.34);
      big.style.opacity = String(bo);
      big.style.transform = `translateY(${level - big.offsetHeight * (narrow ? 1 : 0.93) - (narrow ? bh * sc * 0.95 : 0) + (1 - bo) * 40}px)`;
      knots.textContent = `Speed ${(p * 12).toFixed(1)} kn`;
      raf = requestAnimationFrame(frame);
    };

    readColors();
    size();
    raf = requestAnimationFrame(frame);
    const themeWatch = new MutationObserver(readColors);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const dark = matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", readColors);
    addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      themeWatch.disconnect();
      dark.removeEventListener("change", readColors);
      removeEventListener("resize", size);
    };
  }, []);

  return (
    <div className={styles.scene} ref={sceneRef}>
      <div className={styles.stage} ref={stageRef}>
        <svg className={styles.contours} viewBox="0 0 800 520" aria-hidden="true">
          <ellipse cx="400" cy="300" rx="120" ry="80" />
          <ellipse cx="400" cy="300" rx="200" ry="135" />
          <ellipse cx="400" cy="300" rx="290" ry="190" />
          <ellipse cx="400" cy="300" rx="390" ry="250" />
        </svg>
        <canvas className={styles.back} ref={backRef} aria-hidden="true" />
        <div className={styles.big} ref={bigRef} aria-hidden="true">
          <small>Return missed calls · Chase quotes · Get paid</small>
          Anchored
        </div>
        <div className={styles.boat} ref={boatRef} aria-hidden="true">
          <Boat symbol="boat-helm" viewBox="0 0 640 420" />
        </div>
        <canvas className={styles.front} ref={frontRef} aria-hidden="true" />
        <div className={`${styles.copy} ${styles.pad}`} ref={copyRef}>
          <div className={styles.inner}>
            <div className={styles.copyCol}>{children}</div>
          </div>
        </div>
        <div className={`${styles.hud} ${styles.pad}`} aria-hidden="true">
          <div className={`${styles.inner} ${styles.hudIn}`}>
            <span>38°59′N 76°56′W</span>
            <span>College Park, MD</span>
            <span ref={knotsRef}>Speed 0.0 kn</span>
            <span className={styles.hint}>Scroll to set sail</span>
          </div>
        </div>
      </div>
    </div>
  );
}
