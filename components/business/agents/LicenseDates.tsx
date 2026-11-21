"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { callApi, errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import { licenseSchema, type License } from "@/lib/domain/renewals";
import type { LicensesResponse } from "@/lib/api/contract";
import styles from "./license-dates.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// "License renewal dates" on the Internal Communications page: each license,
// when it expires and where the owner found the date. Every edit saves the
// whole list through the licenses route, then shows what the server returns.
// Saving a date never renews or files anything. The License Clerk skill, when
// chosen, reminds the owner, and marking a license handled stops its reminders.

interface LicenseDatesProps {
  readonly businessId: string;
  readonly licenses: readonly License[];
  readonly enabled: boolean;
}

/** Render the saved license dates and the form to add one; another business starts a fresh form. */
export function LicenseDates(props: LicenseDatesProps) {
  return <LicenseDatesForm key={props.businessId} {...props} />;
}

/** Render the license list and form, saving through the licenses route. */
function LicenseDatesForm({ businessId, licenses, enabled }: LicenseDatesProps) {
  const id = useId();
  const router = useRouter();
  const [saved, setSaved] = useState(licenses);
  const [name, setName] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const sending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  // A refreshed profile updates the facts without remounting the disclosure or hiding the saved result.
  useEffect(() => { setSaved(licenses); }, [licenses]);

  async function save(next: readonly License[], added = false) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await callApi<LicensesResponse>(`/api/businesses/${encodeURIComponent(businessId)}/licenses`, "PUT", { licenses: next });
      if (!active.current) return;
      setSaved(result.licenses);
      if (added) {
        setName("");
        setExpiresOn("");
        setEvidence("");
      }
      setNotice("License dates saved.");
      router.refresh();
    } catch (failure) {
      if (active.current) setError(errorText(failure));
    } finally {
      sending.current = false;
      if (active.current) setBusy(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const candidate = licenseSchema.safeParse({ id: crypto.randomUUID(), name, expiresOn, evidence });
    if (!candidate.success) {
      setError(candidate.error.issues[0]?.message ?? "Check the license date and its source.");
      return;
    }
    void save([...saved, candidate.data], true);
  }

  return (
    <details className={styles.dates}>
      <summary>License renewal dates</summary>
      <div className={styles.content}>
        <p>Record the expiry date and where you found it. Reminders use Eastern time (America/New_York). Anchored never renews or files anything for you.</p>
        {!enabled && <p>License Clerk isn't chosen yet. You can save dates now. Choose License Clerk on Workflows to receive renewal reminders.</p>}
        {saved.length === 0 ? <p>No license dates saved yet.</p> : (
          <ul className={styles.list} aria-label="Saved licenses">
            {saved.map((license) => (
              <li key={license.id}>
                <strong>{license.name}</strong>
                <p>Recorded expiry: <time dateTime={license.expiresOn}>{license.expiresOn}</time></p>
                <details><summary>Date source</summary><p>{license.evidence}</p></details>
                {license.completed === true && <p>Handled. Renewal reminders are stopped.</p>}
                <div className="row">
                  {license.completed !== true && <Button variant="quiet" size="sm" disabled={busy} aria-label={`Mark ${license.name} handled`} onClick={() => void save(saved.map((item) => item.id === license.id ? { ...item, completed: true } : item))}>Mark handled</Button>}
                  <Button variant="quiet" size="sm" disabled={busy} aria-label={`Remove ${license.name} date`} onClick={() => void save(saved.filter((item) => item.id !== license.id))}>Remove date</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className={styles.form} aria-label="Add license date" onSubmit={add}>
          <div className={styles.fields}>
            <label htmlFor={`${id}-name`}>License name<input id={`${id}-name`} value={name} required maxLength={120} disabled={busy} onChange={(event) => setName(event.currentTarget.value)} /></label>
            <label htmlFor={`${id}-expiry`}>Expiry date<input id={`${id}-expiry`} type="date" value={expiresOn} required disabled={busy} onChange={(event) => setExpiresOn(event.currentTarget.value)} /></label>
          </div>
          <label htmlFor={`${id}-source`}>Where did you find this date?<textarea id={`${id}-source`} value={evidence} required maxLength={1000} rows={2} disabled={busy} onChange={(event) => setEvidence(event.currentTarget.value)} /></label>
          <div><Button type="submit" size="sm" disabled={busy || saved.length >= 100}>{busy ? "Saving..." : "Add license"}</Button></div>
          {saved.length >= 100 && <p>You have reached the limit of 100 saved licenses.</p>}
        </form>
        {error !== null && <p role="alert">Your change wasn't saved. {error}</p>}
        <p role="status">{notice}</p>
      </div>
    </details>
  );
}
