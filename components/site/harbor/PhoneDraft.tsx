"use client";

import { useEffect, useRef, useState } from "react";
import { useReveal } from "@/components/site/harbor/useReveal";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// A phone showing Anchored's Approvals on the owner's screen: a catering
// request from the Linden Street Kitchen sample lands, Anchored writes the
// reply, and it waits for Approve. When the phone scrolls into view the
// request arrives, typing dots show, and the reply writes itself out. At rest,
// and with reduced motion, the finished card shows.

const DRAFT =
  "Hi Marcus, thanks for thinking of Linden Street Kitchen! For 40 people we offer three packages: a taco bar, bowls with sides, or family-style platters. Which sounds closest? I can send a quote today.";

/** Render the phone and play the request arriving once it is seen. */
export function PhoneDraft() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const armed = useReveal(ref, () => setStarted(true));

  useEffect(() => {
    if (!started) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    at(250, () => setStep(1));
    at(850, () => setStep(2));
    at(2100, () => {
      setStep(3);
      let n = 0;
      const tick = () => {
        n = Math.min(DRAFT.length, n + 3);
        setTyped(n);
        if (n < DRAFT.length) at(16, tick);
        else at(250, () => setStep(4));
      };
      tick();
    });
    return () => timers.forEach((t) => clearTimeout(t));
  }, [started]);

  const shown = (k: number) => !armed || (started && step >= k);
  const fade = (k: number) => `${styles.fade} ${shown(k) ? styles.on : ""}`;
  const text = !armed || step >= 4 ? DRAFT : DRAFT.slice(0, typed);

  return (
    <div className={styles.phone} ref={ref}>
      <div className={styles.screen}>
        <div className={styles.notch} />
        <p className={styles.appBar}>
          <b>Anchored</b>
          <span>Approvals</span>
        </p>
        <p className={`${styles.notice} ${fade(1)}`}>New catering request, 2:05 p.m.</p>
        <div className={`${styles.draftCard} ${fade(2)}`}>
          <p className={styles.draftFrom}>Front Desk, email to Marcus Reed</p>
          <p className={styles.draftTitle}>Party of 40 in three weeks</p>
          {armed && step === 2 ? (
            <p className={styles.typing} aria-hidden="true">
              <i />
              <i />
              <i />
            </p>
          ) : (
            <p className={styles.draftText}>{text}</p>
          )}
          <p className={`${styles.draftChecks} ${fade(4)}`}>Checked: within your kitchen limit of 60, no allergy claims.</p>
        </div>
        <div className={`${styles.phoneActs} ${fade(4)}`}>
          <button type="button">Skip</button>
          <button type="button">Edit</button>
          <button type="button" className={`${styles.approve} ${armed && step >= 4 ? styles.pulse : ""}`}>
            Approve: Send email
          </button>
        </div>
      </div>
    </div>
  );
}
