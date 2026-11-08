"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { displayAgentName } from "@/components/agent-labels";
import { presentAgents } from "@/components/business/agents/view-model";
import { CORE_AGENTS } from "@/lib/domain/agents";
import { DAY, DAY_END, DAY_START, clockLabel, dayAt, type ChipKind } from "@/components/site/harbor/watch-bill";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The watch bill: one example day at an HVAC shop that plays through when it
// scrolls into view. A clock runs from 7:00 to 20:30, each row lights up at
// its time, and drafts go Drafting, Waiting for you, then Approved or Held.
// The finished day shows at rest, so the section reads without the animation.

const AGENTS = presentAgents(Object.values(CORE_AGENTS).map((agent) => ({ ...agent, niche: false, approval: "every-card" as const })));
const PLAY_MS = 14000;
const CHIP_CLASS: Readonly<Record<ChipKind, string | undefined>> = {
  info: styles.info,
  draft: styles.draft,
  wait: styles.wait,
  sent: styles.sent,
  copied: styles.info,
  held: styles.held,
  sched: styles.sched,
};

/** Render the clock, the tally and the day's rows. */
export function WatchBill() {
  const [minute, setMinute] = useState(DAY_END);
  const [final, setFinal] = useState(true);
  const rowsRef = useRef<HTMLOListElement>(null);
  const raf = useRef(0);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    setFinal(false);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / PLAY_MS);
      setMinute(DAY_START + (DAY_END + 30 - DAY_START) * k);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else {
        setMinute(DAY_END);
        setFinal(true);
      }
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    let played = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!played && entries.some((e) => e.isIntersecting)) {
          played = true;
          play();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [play]);

  const state = dayAt(minute, final);
  const progress = ((Math.min(minute, DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100;

  return (
    <div className={styles.bill}>
      <aside className={styles.clock}>
        <p className={styles.eyebrow}>Watch bill · example day</p>
        <div className={styles.now}>{clockLabel(minute)}</div>
        <p className={styles.day}>College Park Heating &amp; Air · Tuesday</p>
        <div className={styles.track}>
          <i style={{ width: `${progress.toFixed(1)}%` }} />
        </div>
        <div className={styles.tally}>
          <div>
            <b>{state.drafts}</b>
            <span>Drafts written</span>
          </div>
          <div>
            <b>{state.sent + state.copied}</b>
            <span>Sent or copied after approval</span>
          </div>
          <div>
            <b>{state.held}</b>
            <span>Held for quiet hours</span>
          </div>
          <div className={styles.zero}>
            <b>0</b>
            <span>Sent without you</span>
          </div>
        </div>
        <button type="button" className={`${styles.btn} ${styles.ghost} ${styles.replay}`} onClick={play}>
          Replay the day
        </button>
      </aside>
      <div>
        <ol className={styles.rows} ref={rowsRef}>
          {DAY.map((row, i) => {
            const rs = state.rows[i]!;
            return (
              <li key={`${row.minute}-${row.skill}`} className={[rs.future ? styles.future : "", rs.live ? styles.live : ""].join(" ")}>
                <span className={styles.rowTime}>{clockLabel(row.minute)}</span>
                <div className={styles.who}>
                  <b>{displayAgentName(AGENTS.find((agent) => agent.id === row.agent)?.name ?? row.agent)}</b>
                  <span>{row.skill}</span>
                </div>
                <p className={styles.what}>{row.what}</p>
                <span className={`${styles.chip} ${CHIP_CLASS[rs.chip.kind] ?? ""}`}>{rs.chip.label}</span>
              </li>
            );
          })}
        </ol>
        <p className={styles.billNote}>An example day drawn from the HVAC research. The shop is a sample, and none of these texts went to anyone.</p>
      </div>
    </div>
  );
}
