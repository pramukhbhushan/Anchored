"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi, errorText } from "@/components/api";
import type { SetAutomationRequest, SetAutomationResponse } from "@/lib/api/contract";
import type { WorkflowId } from "@/lib/domain/types";
import styles from "./automations.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The on/off switch for one job on the Automations page. It saves at once,
// then the page re-renders from the server to show who now does the job.
// Turning on a job Anchored drafts puts its first question in the business
// chat, and the switch links there so the owner can answer it.

/** The switch for job `workflow`, named `jobName`, which is `on` now. */
export function AutomationSwitch({
  businessId,
  workflow,
  jobName,
  on,
  chatHref,
  disabledReason,
}: {
  readonly businessId: string;
  readonly workflow: WorkflowId;
  readonly jobName: string;
  readonly on: boolean;
  readonly chatHref: string;
  /** Why the switch can't change, such as on the example business; `null` when it can. */
  readonly disabledReason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);

  async function flip(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const body: SetAutomationRequest = { workflow, on: !on };
      const result = await callApi<SetAutomationResponse>(`/api/businesses/${encodeURIComponent(businessId)}/automations`, "PUT", body);
      setAsked(result.asked);
      router.refresh();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.switchBox}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${jobName}: ${on ? "on" : "off"}`}
        className={styles.switch}
        disabled={busy || disabledReason !== null}
        title={disabledReason ?? undefined}
        onClick={() => void flip()}
      >
        <span className={styles.knob} aria-hidden="true" />
        <span>{busy ? "Saving" : on ? "On" : "Off"}</span>
      </button>
      {asked && on && (
        <p className={styles.asked} role="status">
          Anchored asked you a question about it. <Link href={chatHref}>Answer in Chat</Link>
        </p>
      )}
      {error !== null && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
