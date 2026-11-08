"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { callApi, errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import type { FollowupsResponse } from "@/lib/api/contract";
import { SKILLS } from "@/lib/domain/agents";
import { FOLLOWUP_SKILLS, FOLLOWUP_STATES, type FollowupInput, type FollowupSkill, type RecordedFollowup } from "@/lib/domain/followups";
import type { SkillId } from "@/lib/domain/types";
import styles from "./followup-schedule.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// Records the facts and due time for a Customer follow-up. The server decides
// whether a draft is due, and every customer message still needs approval.
// The saved list always comes from the API. Failed writes keep both the form
// and saved records, and late replies cannot change another business's form.

interface FollowupScheduleProps {
  readonly businessId: string;
  readonly records: readonly RecordedFollowup[];
  readonly contacts: readonly { readonly id: string; readonly name: string }[];
  readonly skills: readonly SkillId[];
}

const STATE_LABEL: Readonly<Record<FollowupSkill, string>> = {
  callback: "A call was missed",
  closer: "A quote is still open",
  callfollow: "A call has finished",
  reactivator: "The customer has not returned",
  keeper: "A membership or plan is due for renewal",
  referral: "The job has finished",
  debrief: "A call has finished and its notes are recorded",
  showup: "A booking is on record",
  reviewer: "The job has finished",
};

/** Render a follow-up record form and its saved schedule inside the existing Customer page. */
export function FollowupSchedule(props: FollowupScheduleProps) {
  return <SchedulePanel key={props.businessId} {...props} />;
}

function SchedulePanel(props: FollowupScheduleProps) {
  const savedKey = JSON.stringify(props.records);
  // Refresh saved facts inside the disclosure, leaving the owner's open panel in place.
  return (
    <details className={styles.schedule}>
      <summary>Scheduled follow-ups</summary>
      <ScheduleControl key={`${savedKey}:${props.skills.join(",")}:${props.contacts.map((contact) => contact.id).join(",")}`} {...props} />
    </details>
  );
}

/** Convert an explicit device-local time to an instant, refusing impossible local clock times. */
function dueInstant(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const local = `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (local !== value) return null;
  // A repeated clock time has two possible instants. Do not choose one for the owner.
  for (const minutes of [-120, -90, -60, -30, 30, 60, 90, 120]) {
    const other = new Date(date.getTime() + minutes * 60_000);
    if (other.getFullYear() === date.getFullYear() && other.getMonth() === date.getMonth() && other.getDate() === date.getDate() && other.getHours() === date.getHours() && other.getMinutes() === date.getMinutes()) return null;
  }
  return date;
}

function ScheduleControl({ businessId, records, contacts, skills }: FollowupScheduleProps) {
  const id = useId();
  const router = useRouter();
  const available = FOLLOWUP_SKILLS.filter((skill) => skills.includes(skill));
  const [saved, setSaved] = useState(records);
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [skill, setSkill] = useState<FollowupSkill>(available[0] ?? "callback");
  const [dueAt, setDueAt] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  // UTC keeps the server render and first browser render identical; the device zone is read after mounting.
  const [timeZone, setTimeZone] = useState("UTC");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); return () => { mounted.current = false; }; }, []);
  const instant = dueInstant(dueAt);
  const endpoint = `/api/businesses/${encodeURIComponent(businessId)}/followups`;

  async function write(method: "POST" | "PUT", body: FollowupInput | { readonly id: string }, action: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(action);
    setError(null);
    setNotice("");
    try {
      const result = await callApi<FollowupsResponse>(endpoint, method, body);
      if (!mounted.current) return;
      setSaved(result.records);
      if (method === "POST") {
        setDueAt(""); setSourceId(""); setEvidence(""); setConfirmed(false);
        setNotice("Follow-up recorded. Any draft it creates waits for your approval.");
      } else {
        setNotice("Follow-up canceled. Its saved record is kept.");
      }
      router.refresh();
    } catch (failure) {
      if (mounted.current) setError(errorText(failure));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (instant === null) {
      setError("Choose a real date and time on your device's clock. Choose a time that is neither skipped nor repeated when the clocks change.");
      return;
    }
    if (!confirmed || !available.includes(skill) || !contacts.some((contact) => contact.id === contactId)) return;
    void write("POST", { contactId, skill, dueAt: instant.toISOString(), state: FOLLOWUP_STATES[skill], sourceId: sourceId.trim(), evidence: evidence.trim() }, "save");
  }

  return (
    <>
      <p>Record the job or customer fact and when its draft is due. Anchored never chooses a date for you. Every message waits in Approvals for your OK.</p>
      <p>The scheduled sender must be running to check future dates. Customer drafts use Telegram. Debrief creates an owner note and contacts nobody.</p>
      {available.length === 0 ? <p>Choose a follow-up job on Workflows before recording its schedule.</p> : contacts.length === 0 ? <p>No customers are recorded yet. Open your Telegram link with a customer first.</p> : (
        <form onSubmit={submit}>
          <fieldset className={styles.fields} disabled={busy !== null}>
            <label htmlFor={`${id}-contact`}>Customer<select id={`${id}-contact`} value={contactId} onChange={(event) => setContactId(event.currentTarget.value)} required>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
            <label htmlFor={`${id}-skill`}>Follow-up job<select id={`${id}-skill`} value={skill} onChange={(event) => { setSkill(event.currentTarget.value as FollowupSkill); setConfirmed(false); }} required>{available.map((item) => <option key={item} value={item}>{SKILLS[item].name}</option>)}</select></label>
            <label htmlFor={`${id}-due`}>Draft due (your device's local time)<input id={`${id}-due`} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.currentTarget.value)} aria-describedby={`${id}-time`} required /></label>
            <label htmlFor={`${id}-source`}>Quote, call or job reference<input id={`${id}-source`} value={sourceId} onChange={(event) => setSourceId(event.currentTarget.value)} pattern="[A-Za-z0-9_.:-]+" maxLength={80} title="Use letters, numbers, dots, colons, underscores or hyphens." required /></label>
            <label className={styles.wide} htmlFor={`${id}-evidence`}>Where this fact came from<textarea id={`${id}-evidence`} value={evidence} onChange={(event) => setEvidence(event.currentTarget.value)} maxLength={1000} required /></label>
            <p className={styles.wide} id={`${id}-time`}>{instant === null ? "The saved time includes your device's time zone. Check the displayed offset when clocks change." : `Chosen time: ${instant.toLocaleString("en-US", { timeZone, timeZoneName: "shortOffset" })}.`}</p>
            <label className={`${styles.confirm} ${styles.wide}`}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} required />I have recorded this fact: {STATE_LABEL[skill]}.</label>
            {(skill === "reviewer" || skill === "referral") && <p className={styles.wide}>A paid invoice alone does not show that a job is finished. Record the completed job before scheduling this ask.</p>}
            <div><Button type="submit" size="sm" disabled={busy !== null || !confirmed}>{busy === "save" ? "Recording..." : "Record follow-up"}</Button></div>
          </fieldset>
        </form>
      )}
      {error !== null && <p role="alert">Your change wasn't saved. {error}</p>}
      <p role="status">{notice}</p>
      {saved.length === 0 ? <p>No follow-ups recorded.</p> : <ul className={styles.records}>{saved.map((record) => (
        <li key={record.id}>
          <div><strong>{SKILLS[record.skill].name}: {contacts.find((contact) => contact.id === record.contactId)?.name ?? "Recorded customer"}</strong><p>Draft due: <time dateTime={record.dueAt}>{new Date(record.dueAt).toLocaleString("en-US", { timeZone, timeZoneName: "shortOffset" })}</time>. Reference: {record.sourceId}.</p><p>{STATE_LABEL[record.skill]}. Source: {record.evidence}</p>{record.status === "cancelled" && <p>Canceled</p>}</div>
          {record.status === "active" && <Button variant="quiet" size="sm" disabled={busy !== null} onClick={() => void write("PUT", { id: record.id }, record.id)} aria-label={`Cancel ${SKILLS[record.skill].name} for ${contacts.find((contact) => contact.id === record.contactId)?.name ?? "recorded customer"}`}>{busy === record.id ? "Canceling..." : "Cancel follow-up"}</Button>}
        </li>
      ))}</ul>}
    </>
  );
}
