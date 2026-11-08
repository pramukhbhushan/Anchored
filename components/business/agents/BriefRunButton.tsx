"use client";

import { useEffect, useId, useRef, useState } from "react";
import { errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";

// =============================================================================
// Module Overview
// =============================================================================
// Runs the owner's brief through an agreed callback, preserving the last
// successful brief when a refresh fails. No customer send happens in this view.

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

/** Show the last brief and an available Run now action without assuming a server endpoint. */
export function BriefRunButton(props: BriefRunButtonProps) {
  return <BriefControl key={`${props.businessId}:${props.brief?.generatedAt ?? "none"}`} {...props} />;
}

function BriefControl({ brief, run, unavailableReason }: BriefRunButtonProps) {
  const id = useId();
  const [latest, setLatest] = useState(brief);
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
      setLatest(result);
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
      {latest === null ? <p>{run === undefined ? "Your daily brief is not available yet." : "No daily brief has been generated yet."}</p> : <><p className="prose" style={{ whiteSpace: "pre-line" }}>{latest.text}</p>{when !== null && Number.isFinite(when.getTime()) && <p className="fine">Last updated <time dateTime={latest.generatedAt}>{when.toLocaleString("en-US", { timeZone: OWNER_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>.</p>}</>}
      {run === undefined && <p className="fine">{unavailableReason ?? "Run now isn't available yet. Your saved brief stays here."}</p>}
      {error !== null && <p role="alert">The brief didn't update. {error} Try Run now again.</p>}
      <p role="status">{notice}</p>
    </section>
  );
}
