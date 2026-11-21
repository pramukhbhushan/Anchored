"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { callApi, errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import type { DeleteTelegramResponse } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// "Remove from Telegram" on a sent outbox row. The Approvals page shows it only
// for a message the server says can still be removed. The outbox keeps its
// record of the send, a second tap waits for the first, and the note says what
// the server reported. Removing a message can't unsend it from someone who
// already read it.

/** Render the button that removes one sent message from Telegram, then refreshes the outbox. */
export function DeleteTelegramMessage({ businessId, entryId }: { readonly businessId: string; readonly entryId: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  async function remove() {
    if (busy.current || removed) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await callApi<DeleteTelegramResponse>(`/api/businesses/${encodeURIComponent(businessId)}/outbox/${encodeURIComponent(entryId)}/delete`, "POST", { confirm: true });
      setRemoved(result.deleted);
      setMessage(result.message);
      router.refresh();
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="handoff">
      {!removed && (
        <div className="handoff-acts">
          <Button variant="secondary" size="sm" disabled={pending} onClick={remove}>{pending ? "Removing..." : "Remove from Telegram"}</Button>
        </div>
      )}
      <small>Someone may already have read this message.</small>
      {message !== null && <p className="handoff-note" role="status">{message}</p>}
    </div>
  );
}
