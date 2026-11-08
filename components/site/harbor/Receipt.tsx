"use client";

import { useRef, useState } from "react";
import { useReveal } from "@/components/site/harbor/useReveal";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The Linden Street Kitchen sample's monthly plan as a printed receipt: the
// tools it keeps add nothing, the tools it buys bill on their own, and one $29
// line covers everything Anchored drafts. It prints line by line when it
// scrolls into view; at rest it shows whole.

/** One receipt line: the job, who covers it, and what it adds each month. */
export interface ReceiptLine {
  readonly job: string;
  readonly by: string;
  readonly cost: string;
}

/** Render the receipt for `lines` with `total`, printing it once it is seen. */
export function Receipt({ shop, lines, total }: { readonly shop: string; readonly lines: readonly ReceiptLine[]; readonly total: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [printed, setPrinted] = useState(false);
  const armed = useReveal(ref, () => setPrinted(true));
  const summary = `Example monthly plan for ${shop}: ${lines.map((l) => `${l.job} by ${l.by}, ${l.cost}`).join("; ")}. Each month ${total}.`;
  return (
    <div className={`${styles.receipt} ${armed && !printed ? styles.unprinted : ""}`} ref={ref} role="img" aria-label={summary}>
      <p className={styles.rHead}>{shop}</p>
      <p className={styles.rSub}>Monthly plan, example</p>
      <hr className={styles.rRule} />
      {lines.map((line) => (
        <div key={line.job} className={styles.rLine}>
          <span>
            {line.job}
            <small>{line.by}</small>
          </span>
          <span>{line.cost}</span>
        </div>
      ))}
      <hr className={styles.rRule} />
      <div className={styles.rTotal}>
        <span>Each month</span>
        <span>{total}</span>
      </div>
    </div>
  );
}
