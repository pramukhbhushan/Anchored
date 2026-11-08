"use client";

import { useEffect, useRef, useState } from "react";
import { useReveal } from "@/components/site/harbor/useReveal";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// A scout's find for the Linden Street Kitchen sample. When it scrolls into
// view, the catering tools in the catalog flick past while it checks them,
// then the find lands with its Checked stamp. The facts come from the catalog
// entry for Perfect Venue in lib/domain/catalog.ts.

const CHECKING: readonly string[] = ["ezCater", "Perfect Venue"];

/** Render the scan line and the found tool, and play the scan once it is seen. */
export function ScoutFind() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const armed = useReveal(ref, () => setStarted(true));

  useEffect(() => {
    if (!started) return;
    const timers = CHECKING.map((name, i) => window.setTimeout(() => setChecking(name), 300 + i * 650));
    timers.push(window.setTimeout(() => setDone(true), 300 + CHECKING.length * 650));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [started]);

  const landed = !armed || done;
  let scan = (
    <>
      <b>{CHECKING.length} tools checked</b> for catering requests. 1 writes replies for you.
    </>
  );
  if (!landed) {
    scan = checking ? (
      <>
        Checking <b>{checking}</b>
      </>
    ) : (
      <>Looking for tools that answer catering requests.</>
    );
  }

  return (
    <div className={styles.scoutSide} ref={ref}>
      <p className={styles.scan} aria-live="polite">
        {scan}
      </p>
      <div className={`${styles.found} ${landed ? "" : styles.waiting}`}>
        <p className={`${styles.checked} ${armed && done ? styles.thump : ""}`}>Checked</p>
        <p className={styles.foundFor}>Found for Linden Street Kitchen</p>
        <h3>Perfect Venue</h3>
        <p className={styles.foundWhat}>Takes event and catering inquiries in one place, and its AI writes the replies.</p>
        <dl className={styles.facts}>
          <div>
            <dt>Cost</dt>
            <dd>Free plan, paid from $199 a month</dd>
          </div>
          <div>
            <dt>Acts on its own</dt>
            <dd>Not stated, so we flag it</dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>Nov 6, from its pricing page</dd>
          </div>
        </dl>
        <div className={styles.foundActs}>
          <button type="button" className={styles.go}>
            Compare
          </button>
          <button type="button">Not now</button>
        </div>
      </div>
    </div>
  );
}
