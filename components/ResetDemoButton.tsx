"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { callApi, errorText } from "@/components/api";
import { APP_HREF } from "@/components/routes";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";

// =============================================================================
// Module Overview
// =============================================================================
// "Reset demo" in the sidebar. The first press opens a confirmation that
// names what goes; the second clears this session's businesses, choices,
// approvals and outbox through `/api/reset`, then returns to the business list.

/** Say what a reset deletes, naming how many of the owner's businesses go. */
function resetWarning(ownCount: number): string {
  const businesses =
    ownCount === 0 ? "" : ownCount === 1 ? "your 1 business, " : `your ${ownCount} businesses, `;
  return `This deletes ${businesses}every path you chose, and all approvals and outbox messages in this session. Sample businesses go back to how they started.`;
}

/** Render the reset button, its confirmation, and run the reset. */
export function ResetDemoButton({ ownCount }: { readonly ownCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
  }, [confirming]);

  async function reset() {
    setBusy(true);
    try {
      await callApi<{ ok: true }>("/api/reset", "POST");
      toast("Demo reset");
      setConfirming(false);
      // `refresh` re-renders the shell so its business list and counts drop what was deleted.
      router.push(APP_HREF);
      router.refresh();
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="side-foot-link" title="Reset demo" onClick={() => setConfirming(true)}>
        <RotateCcw aria-hidden="true" size={16} />
        <span className="side-foot-text">Reset demo</span>
      </button>
    );
  }

  return (
    <div className="reset-confirm" role="group" aria-label="Confirm reset">
      <p>{resetWarning(ownCount)}</p>
      <div className="row">
        <Button ref={confirmButton} size="sm" onClick={reset} disabled={busy}>
          {busy ? "Resetting..." : "Delete and reset"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
