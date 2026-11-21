"use client";

import { useEffect, useId, useRef, useState } from "react";
import { errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import { ownerTime } from "@/components/business/owner-time";

// =============================================================================
// Module Overview
// =============================================================================
// The daily brief and its Run now button. `run` writes a new brief; a failed
// run keeps the last brief on screen and says what went wrong. Nothing here
// sends anything to a customer.

/** One written brief: its lines as text, and when it was written. */
export interface BriefRunResult {
  readonly text: string;
  readonly generatedAt: string;
}

interface BriefRunButtonProps {
  readonly businessId: string;
  readonly brief: BriefRunResult | null;
  readonly run?: () => Promise<BriefRunResult>;
  readonly unavailableReason?: string;
}

/** Show the latest brief and, when `run` is given, a Run now button that writes a new one. */
export function BriefRunButton(props: BriefRunButtonProps) {
  // Another business remounts the control, so a late run for the last one never lands here.
  return <BriefControl key={props.businessId} {...props} />;
}

/** Return whichever brief is newer: the page's or this button's last run. */
function newer(brief: BriefRunResult | null, ran: BriefRunResult | null): BriefRunResult | null {
  if (ran === null) return brief;
  return brief === null || Date.parse(ran.generatedAt) > Date.parse(brief.generatedAt) ? ran : brief;
}

/** Render the brief, its Run now button and what happened on the last run. */
function BriefControl({ brief, run, unavailableReason }: BriefRunButtonProps) {
  const id = useId();
  // A run shows at once; the refreshed page or the scheduled brief takes over once it is as new or newer.
  const [ran, setRan] = useState<BriefRunResult | null>(null);
  const latest = newer(brief, ran);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const active = useRef(true);
  const sending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function refresh() {
    if (run === undefined || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await run();
      if (!active.current) return;
      setRan(result);
      setNotice("Your brief is up to date.");
    } catch (failure) {
      if (active.current) setError(errorText(failure));
    } finally {
      sending.current = false;
      if (active.current) setBusy(false);
    }
  }

  const when = latest === null ? null : new Date(latest.generatedAt);
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="section-head"><h2 id={`${id}-title`}>Daily brief</h2>{run !== undefined && <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={busy}>{busy ? "Updating..." : "Run now"}</Button>}</div>
      {latest === null ? <p>{run === undefined ? "Your daily brief is not available yet." : "No brief yet. Press Run now to write one."}</p> : <><p className="prose" style={{ whiteSpace: "pre-line" }}>{latest.text}</p>{when !== null && Number.isFinite(when.getTime()) && <p className="fine">Last updated <time dateTime={latest.generatedAt}>{ownerTime(when)}</time>.</p>}</>}
      {run === undefined && <p className="fine">{unavailableReason ?? "Run now isn't available yet. Your saved brief stays here."}</p>}
      {error !== null && <p role="alert">The brief didn't update. {error} Try Run now again.</p>}
      <p role="status">{notice}</p>
    </section>
  );
}
