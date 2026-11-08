"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// Plays a section's animation once, when the reader scrolls to it. The section
// renders complete on the server and stays complete for anyone who prefers
// reduced motion or who loads the page already looking at it. Only a section
// still below the fold starts "armed" (hidden or reset), and a scroll check
// backs up the IntersectionObserver so nothing stays hidden if it never fires.

/** Return whether reduced motion is on. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Arm `ref` when it starts below the fold, and call `onSight` once its top reaches 80% of the window. */
export function useReveal(ref: RefObject<HTMLElement | null>, onSight: () => void): boolean {
  const [armed, setArmed] = useState(false);
  const latest = useRef(onSight);
  latest.current = onSight;

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || el.getBoundingClientRect().top <= innerHeight * 0.9) return;
    setArmed(true);
    let done = false;
    const check = () => {
      if (done || el.getBoundingClientRect().top > innerHeight * 0.8) return;
      done = true;
      stop();
      latest.current();
    };
    const onScroll = () => requestAnimationFrame(check);
    const io = new IntersectionObserver(check, { threshold: [0, 0.1, 0.25, 0.5] });
    const stop = () => {
      io.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
    io.observe(el);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return stop;
  }, [ref]);

  return armed;
}
