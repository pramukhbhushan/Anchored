"use client";

import { useEffect, useId, useRef, useState } from "react";
import { errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import styles from "./rule.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's switch for the acknowledgment, the one fixed text Anchored sends
// a customer without waiting for an OK. It starts on. "Right now" shows the
// state the server saved, and the checkbox the owner's unsaved choice. A
// caller that can't save, such as a guest, passes no `save`, and the control
// says why instead of offering the button.

export interface AcknowledgmentRuleState {
  readonly enabled: boolean;
  readonly approvedAt?: string | null;
}

interface AcknowledgmentRuleProps {
  readonly businessId: string;
  readonly businessName: string;
  readonly state: AcknowledgmentRuleState | null;
  readonly save?: (enabled: boolean) => Promise<AcknowledgmentRuleState>;
  readonly unavailableReason?: string;
}

/** Say which saved state `state` is, so a page refresh that brings back the state just saved changes nothing. */
function stateKey(state: AcknowledgmentRuleState | null): string {
  return state === null ? "unknown" : `${state.enabled}:${state.approvedAt ?? ""}`;
}

/** Render the acknowledgment switch for one business, showing only state the server saved. */
export function AcknowledgmentRule(props: AcknowledgmentRuleProps) {
  return <RuleControl key={props.businessId} {...props} />;
}

function RuleControl({ businessName, state, save, unavailableReason }: AcknowledgmentRuleProps) {
  const id = useId();
  const [saved, setSaved] = useState(state);
  const [draft, setDraft] = useState(state?.enabled ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  // A save refreshes the page, which passes back the state just saved; the "Saved" notice must survive that.
  // A state saved somewhere else replaces what this control shows.
  const [givenKey, setGivenKey] = useState(stateKey(state));
  if (stateKey(state) !== givenKey) {
    setGivenKey(stateKey(state));
    if (stateKey(state) !== stateKey(saved)) {
      setSaved(state);
      setDraft(state?.enabled ?? false);
      setError(null);
      setNotice("");
    }
  }
  const active = useRef(true);
  const sending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function submit() {
    if (save === undefined || saved === null || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await save(draft);
      if (!active.current) return;
      setSaved(result);
      setDraft(result.enabled);
      setNotice(result.enabled ? "Saved. The acknowledgment rule is on." : "Saved. The acknowledgment rule is off.");
    } catch (failure) {
      if (active.current) setError(errorText(failure));
    } finally {
      sending.current = false;
      if (active.current) setBusy(false);
    }
  }

  const canChange = save !== undefined && saved !== null;
  return (
    <section className={styles.rule} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Acknowledgment rule</h2>
      <p>When a customer messages, Anchored sends this right away so they know it arrived. Your real reply still waits for your OK.</p>
      <blockquote className={styles.template}>Thanks, {businessName} got your message and will reply soon.</blockquote>
      <p>It never goes to a customer who sent /stop.</p>
      <p className={styles.saved}>{saved === null ? "Saved rule state isn't available yet." : saved.enabled ? "Right now: On" : "Right now: Off"}</p>
      {saved !== null && <label className={styles.choice}><input type="checkbox" checked={draft} disabled={!canChange || busy} onChange={(event) => { setDraft(event.currentTarget.checked); setNotice(""); }} />Send this right away, without waiting for my OK</label>}
      {canChange ? <div><Button size="sm" onClick={() => void submit()} disabled={busy || draft === saved.enabled}>{busy ? "Saving..." : "Save"}</Button></div> : <p>{unavailableReason ?? "This rule can't be changed yet. Check back when rule controls are available."}</p>}
      {error !== null && <p role="alert">Your change wasn't saved. {error} Try saving again.</p>}
      <p role="status">{notice}</p>
    </section>
  );
}
