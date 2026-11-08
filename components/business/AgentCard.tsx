"use client";

import { Check, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { ApiCallError, callApi, errorText } from "@/components/api";
import { cardAnchor } from "@/components/routes";
import { useToast, type ToastLink } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import type { CardRecord, DecideCardRequest, DecideCardResponse, RewriteResponse } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// One card in the approvals feed. A pending card offers Approve, Edit, Skip
// and, when an AI provider is set up, "Rewrite in my voice"; a locked card
// offers "I'll handle it". Approve always sends the text on screen, a send to
// many people asks once more, and a refusal or delay from the server shows on the card.

const REWRITE_FAILED = "Couldn't rewrite right now. The draft is unchanged.";
const STALE_DRAFT = "This draft changed. Reload to see the latest.";
const SEE_OUTBOX: ToastLink = { label: "See outbox", href: "#outbox" };

/** Return who a send-to-many card reaches, such as "118 customers", or `null` for a single recipient. */
function massAudience(card: CardRecord): string | null {
  return /^send to (.+)$/i.exec(card.action.trim())?.[1] ?? null;
}

/** Return what a "Copy post" or "Copy reply" card copies, such as "post", or `null` for a card that sends. */
function copiedThing(card: CardRecord): string | null {
  return /^copy (.+)$/i.exec(card.action.trim())?.[1]?.toLowerCase() ?? null;
}

/** Copy `text` to the clipboard, falling back to a hidden text box where the async API is missing or refused. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No async clipboard (an insecure origin or an older browser), or permission refused; try the old way below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    // Nothing left to try; the toast tells the owner where the text still is.
    return false;
  }
}

/** Return the toast after an approval that went through; `copied` says whether a copy card's text reached the clipboard. */
function approvedMessage(card: CardRecord, copied: boolean | null): string {
  const thing = copiedThing(card);
  if (thing !== null && copied !== null) {
    return copied
      ? `Approved. The ${thing} is on your clipboard, ready to paste.`
      : `Approved. Your browser blocked the clipboard, so copy the ${thing} from the outbox.`;
  }
  if (card.channel === "locked") return "Marked as yours";
  if (card.channel === "sms") return "Approved. The text waits in your outbox.";
  if (card.channel === "email") return "Approved. The email waits in your outbox.";
  return "Approved and logged in your outbox.";
}

/** Return the status line for a decided card. */
function decidedLabel(card: CardRecord): string {
  if (card.status === "skipped") return "Skipped";
  if (card.channel === "locked") return "Yours to handle";
  return card.edited ? "Approved with your edits" : "Approved";
}

/** Return the line above a card's title: who drafted it and, when it has one, who it goes to. */
function whoLine(card: CardRecord, source: string): string {
  if (card.to === undefined || card.to === "") return source;
  const to = card.channel === "sms" ? `text to ${card.to}` : card.channel === "email" ? `email to ${card.to}` : `for ${card.to}`;
  return `${source}, ${to}`;
}

/** Render one feed card; `source` names who drafted it, such as "Follow-up agent". */
export function AgentCard({
  card,
  source,
  canRewrite,
}: {
  readonly card: CardRecord;
  readonly source: string;
  readonly canRewrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const editId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.body);
  // The body waiting on "Yes, send to N customers", or `null` when no confirmation is open.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  // Keeps the buttons disabled until the refreshed feed arrives.
  const [refreshing, startRefresh] = useTransition();
  const locked = card.channel === "locked";
  const pending = card.status === "pending";
  const audience = massAudience(card);

  /** Send the decision; `copied` is whether a copy card's text reached the clipboard, `null` for any other card. */
  async function decide(request: DecideCardRequest, copied: boolean | null = null) {
    setBusy(true);
    setNote("");
    setStale(false);
    try {
      const result = await callApi<DecideCardResponse>(`/api/cards/${encodeURIComponent(card.id)}`, "POST", request);
      if (result.blocked !== undefined) {
        // A blocked card stays pending; a delayed one is approved and queued, and the reason says when.
        setNote(result.card.status === "pending" ? `Not sent. ${result.blocked}` : result.blocked);
      } else if (request.decision === "skip") {
        toast("Skipped");
      } else {
        toast(approvedMessage(card, copied), locked ? undefined : SEE_OUTBOX);
      }
      setEditing(false);
      setConfirming(null);
      startRefresh(() => router.refresh());
    } catch (error) {
      // 409: the card moved on since the owner saw it, so a reload shows its real state. The route says how it moved:
      // a changed draft, a card already decided, or a workflow that no longer uses the agent.
      const isStale = error instanceof ApiCallError && error.status === 409;
      setStale(isStale);
      setNote(isStale && error.message === "" ? STALE_DRAFT : errorText(error));
    } finally {
      setBusy(false);
    }
  }

  /** Approve `body`, the exact text on screen, asking first when it goes to many people. */
  function approve(body: string) {
    if (audience !== null && confirming === null) {
      setConfirming(body);
      return;
    }
    if (copiedThing(card) === null) {
      void decide({ decision: "approve", body });
      return;
    }
    // Copy inside the click, while the browser still counts it as the owner's gesture, then record the approval.
    void copyText(body).then((copied) => decide({ decision: "approve", body }, copied));
  }

  function approveEdited() {
    const body = draft.trim();
    // An empty draft falls back to the original text, which is what the card shows again.
    approve(body === "" ? card.body : body);
  }

  async function rewrite() {
    setBusy(true);
    setNote("Rewriting in your voice...");
    try {
      await callApi<RewriteResponse>(`/api/cards/${encodeURIComponent(card.id)}/rewrite`, "POST");
      setNote("");
      startRefresh(() => router.refresh());
    } catch (error) {
      // A 4xx carries the route's own reason, such as a rewrite that changed facts; anything else gets the generic line.
      const routeSaid = error instanceof ApiCallError && error.status >= 400 && error.status < 500;
      setNote(routeSaid ? error.message : REWRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  function reload() {
    setNote("");
    setStale(false);
    setEditing(false);
    startRefresh(() => router.refresh());
  }

  const disabled = busy || refreshing;
  const head = (
    <>
      <p className="card-who">{whoLine(card, source)}</p>
      <h3>{card.title}</h3>
    </>
  );
  const noteLine = (
    <p className={`card-note${note === "" ? "" : " has-note"}`} role="status">
      {note}
      {stale && (
        <Button variant="quiet" size="sm" onClick={reload} disabled={refreshing}>
          Reload
        </Button>
      )}
    </p>
  );

  if (!pending) {
    // A decided card is one row: the owner already read its draft, so only the outcome is new.
    return (
      <article className="card-done">
        <h3>{card.title}</h3>
        <p className="card-status">{decidedLabel(card)}</p>
        {noteLine}
      </article>
    );
  }

  let actions: ReactNode;
  if (confirming !== null) {
    actions = (
      <div className="confirm" role="group" aria-label="Confirm send">
        <p>
          This sends to <b>{audience}</b> at once. Send it?
        </p>
        <div className="card-acts">
          <Button size="sm" onClick={() => approve(confirming)} disabled={disabled} autoFocus>
            Yes, send to {audience}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(null)} disabled={disabled}>
            Cancel
          </Button>
        </div>
      </div>
    );
  } else if (locked) {
    actions = (
      <div className="card-acts">
        <Button size="sm" onClick={() => approve(card.body)} disabled={disabled}>
          I&apos;ll handle it
        </Button>
      </div>
    );
  } else if (editing) {
    actions = (
      <div className="card-acts">
        <Button size="sm" onClick={approveEdited} disabled={disabled}>
          Approve edited version
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setEditing(false);
            setDraft(card.body);
          }}
          disabled={disabled}
        >
          Cancel
        </Button>
      </div>
    );
  } else {
    actions = (
      <div className="card-acts">
        <Button size="sm" onClick={() => approve(card.body)} disabled={disabled}>
          Approve: {card.action}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          aria-label={`Edit: ${card.title}`}
          onClick={() => {
            setDraft(card.body);
            setEditing(true);
          }}
          disabled={disabled}
        >
          Edit
        </Button>
        <Button
          variant="quiet"
          size="sm"
          aria-label={`Skip: ${card.title}`}
          onClick={() => decide({ decision: "skip" })}
          disabled={disabled}
        >
          Skip
        </Button>
        {canRewrite && card.channel !== "list" && (
          <Button variant="quiet" size="sm" onClick={rewrite} disabled={disabled}>
            Rewrite in my voice
          </Button>
        )}
      </div>
    );
  }

  return (
    <article className={`card${locked ? " locked" : ""}`} id={cardAnchor(card.key)}>
      <div className="card-top">
        {head}
        <p className="card-why">{card.reason}</p>
      </div>
      {editing ? (
        <div className="card-edit">
          <label className="fine" htmlFor={editId}>
            Edit the draft
          </label>
          <textarea id={editId} value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
        </div>
      ) : (
        <p className="draft">{card.body}</p>
      )}
      {card.checks.length > 0 && (
        <p className={`card-checks${locked ? " is-warn" : ""}`}>
          {locked ? <CircleAlert aria-hidden="true" size={16} /> : <Check aria-hidden="true" size={16} />}
          <span>
            {locked ? "" : "Checked: "}
            {card.checks.join(", ")}
          </span>
        </p>
      )}
      {actions}
      {noteLine}
    </article>
  );
}
