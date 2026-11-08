"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { COLUMNS, DAY_END, DAY_START, boardAt, clockLabel, columnAt, CARDS, type Column } from "@/components/site/harbor/day-board";
import { prefersReducedMotion, useReveal } from "@/components/site/harbor/useReveal";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// One example day at Linden Street Kitchen as a board with three columns:
// Waiting on you, Done, and Held till morning. When the board scrolls into
// view a clock runs from 9:00 to 21:00; each message lands in Waiting, then
// slides to Done or Held once the owner approves it. The day loops while the
// board is on screen. At rest, and with reduced motion, the finished day shows.

const PLAY_MS = 14000;
const HOLD_MS = 3500;
const STAMP_CLASS: Readonly<Record<Column, string | undefined>> = { wait: undefined, done: styles.stampSent, held: styles.stampHeld };

/** The board's shape at `minute`: which column each card is in, as one string, so a render happens only when it changes. */
const shapeAt = (minute: number) => CARDS.map((card) => columnAt(card, minute) ?? "-").join(",");

/** Render the board and play the day when it is seen. */
export function DayBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [minute, setMinute] = useState(DAY_END);
  const [still, setStill] = useState(false);
  const raf = useRef(0);
  const loop = useRef(0);
  const pending = useRef(false);
  const last = useRef(new Map<string, { readonly rect: DOMRect; readonly column: string }>());

  const onScreen = useCallback(() => {
    const r = boardRef.current?.getBoundingClientRect();
    return r !== undefined && r.top < innerHeight && r.bottom > 0;
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    clearTimeout(loop.current);
    pending.current = false;
    if (prefersReducedMotion()) return;
    const t0 = performance.now();
    let shape = "";
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / PLAY_MS);
      const m = DAY_START + (DAY_END - DAY_START) * k;
      if (clockRef.current) clockRef.current.textContent = clockLabel(m);
      if (barRef.current) barRef.current.style.width = `${(k * 100).toFixed(1)}%`;
      const next = shapeAt(m);
      if (next !== shape) {
        shape = next;
        setMinute(m);
      }
      if (k < 1) raf.current = requestAnimationFrame(step);
      else {
        setMinute(DAY_END);
        loop.current = window.setTimeout(() => {
          if (onScreen()) play();
          else pending.current = true;
        }, HOLD_MS);
      }
    };
    raf.current = requestAnimationFrame(step);
  }, [onScreen]);

  useReveal(wrapRef, play);

  useEffect(() => {
    setStill(prefersReducedMotion());
    const onScroll = () => {
      if (pending.current && onScreen()) play();
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf.current);
      clearTimeout(loop.current);
    };
  }, [onScreen, play]);

  // Slide each card from where it was to where it is now, and stamp the ones that just moved.
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const seen = new Map<string, { readonly rect: DOMRect; readonly column: string }>();
    board.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => {
      const id = el.dataset.card ?? "";
      const column = el.dataset.column ?? "";
      const rect = el.getBoundingClientRect();
      const before = last.current.get(id);
      if (!prefersReducedMotion()) {
        if (!before) el.animate([{ opacity: 0, transform: "translateY(-10px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "ease-out" });
        else if (before.rect.left !== rect.left || before.rect.top !== rect.top) {
          el.animate([{ transform: `translate(${before.rect.left - rect.left}px,${before.rect.top - rect.top}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
        }
        if (before && before.column !== column) {
          el.querySelector("[data-stamp]")?.animate([{ transform: "rotate(-3deg) scale(1.7)", opacity: 0 }, { transform: "rotate(-3deg) scale(1)", opacity: 1 }], { duration: 260, delay: 480, easing: "cubic-bezier(.2,.9,.3,1.2)", fill: "backwards" });
        }
      }
      seen.set(id, { rect, column });
    });
    last.current = seen;
  }, [minute]);

  const board = boardAt(minute);
  return (
    <div ref={wrapRef}>
      <div className={styles.boardBar}>
        <div className={styles.clockWrap}>
          <span className={styles.clock} ref={clockRef}>
            {clockLabel(DAY_END)}
          </span>
          <span className={styles.shop}>Linden Street Kitchen, Tuesday</span>
        </div>
        <div className={styles.barRight}>
          <span className={styles.zero}>
            Sent without the owner: <b>0</b>
          </span>
          {!still && (
            <button type="button" className={`${styles.btn} ${styles.ghost} ${styles.replay}`} onClick={play}>
              Replay the day
            </button>
          )}
        </div>
      </div>
      <div className={styles.track}>
        <i ref={barRef} />
      </div>
      <div className={styles.board} ref={boardRef}>
        {COLUMNS.map(({ id, title }) => (
          <section key={id} className={styles.col} aria-label={title}>
            <h3 className={styles.colHead}>
              {title} <span>{board[id].length}</span>
            </h3>
            <ul className={styles.cards}>
              {board[id].map((card) => (
                <li key={card.id} className={styles.card} data-card={card.id} data-column={id}>
                  <p className={styles.cardTop}>
                    <b>{card.who}</b>
                    <span>{card.about}</span>
                  </p>
                  <p className={styles.txt}>{card.text}</p>
                  {id === "wait" ? (
                    <div className={styles.cardActs}>
                      {card.actions.map((action, i) => (
                        <button key={action} type="button" className={i === 0 ? styles.go : undefined}>
                          {action}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={`${styles.stamp} ${STAMP_CLASS[id] ?? ""}`} data-stamp>
                      {card.stamp}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
