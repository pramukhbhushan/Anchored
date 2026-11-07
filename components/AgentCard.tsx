"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { callApi, errorText } from "@/components/api";
import { useToast } from "@/components/Toast";
import type { CardRecord, DecideCardRequest, DecideCardResponse, RewriteResponse } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// One card in the agents feed. A pending card offers Approve, Edit, Skip and,
// when an AI provider is set up, "Rewrite in my voice"; a locked card offers "I'll
// handle it". When the executor refuses or delays a send, the card shows why.

const REWRITE_FAILED = "Couldn't rewrite right now. The draft is unchanged.";

/** Return the toast the prototype showed after an approval that went through. */
function approvedMessage(card: CardRecord): string {
  if (card.channel === "locked") return "Marked as yours";
  return card.channel === "sms" ? "Approved. Text shown on the simulated phone." : "Approved. Logged in the outbox.";
}

/** Return the status line for a decided card. */
function decidedLabel(card: CardRecord): string {
  if (card.status === "skipped") return "Skipped";
  if (card.channel === "locked") return "Yours to handle";
  return card.edited ? "Approved with your edits" : "Approved";
}

/** Render one feed card; `source` names who drafted it, such as "Follow-up agent, Closer skill". */
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.body);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Keeps the buttons disabled until the refreshed feed arrives.
  const [refreshing, startRefresh] = useTransition();
  const locked = card.channel === "locked";
  const pending = card.status === "pending";

  async function decide(request: DecideCardRequest) {
    setBusy(true);
    setNote("");
    try {
      const result = await callApi<DecideCardResponse>(`/api/cards/${encodeURIComponent(card.id)}`, "POST", request);
      if (result.blocked !== undefined) {
        // A blocked card stays pending; a delayed one is approved and queued, and the reason says when.
        setNote(result.card.status === "pending" ? `Not sent. ${result.blocked}` : result.blocked);
      } else {
        toast(request.decision === "skip" ? "Skipped" : approvedMessage(card));
      }
      setEditing(false);
      startRefresh(() => router.refresh());
    } catch (error) {
      setNote(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  function approveEdited() {
    const body = draft.trim();
    // An empty or unchanged draft approves the original, so it isn't counted as an edit.
    void decide(body !== "" && body !== card.body ? { decision: "approve", body } : { decision: "approve" });
  }

  async function rewrite() {
    setBusy(true);
    setNote("Rewriting in your voice...");
    try {
      await callApi<RewriteResponse>(`/api/cards/${encodeURIComponent(card.id)}/rewrite`, "POST");
      setNote("");
      startRefresh(() => router.refresh());
    } catch {
      setNote(REWRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || refreshing;
  const head = (
    <>
      <div className="who">
        <span>
          {locked ? "Locked for you by " : "Drafted by "}
          <b>{source}</b>
        </span>
        <span>{card.to ? `To ${card.to}` : ""}</span>
      </div>
      <h3>{card.title}</h3>
    </>
  );
  const noteLine = (
    <p className="tiny muted" role="status">
      {note}
    </p>
  );

  if (!pending) {
    return (
      <article className="card done">
        {head}
        <p className="draft">{card.body}</p>
        <p className="status">{decidedLabel(card)}</p>
        {noteLine}
      </article>
    );
  }

  const editId = `ed-${card.id}`;
  return (
    <article className="card">
      {head}
      {editing ? (
        <>
          <label className="tiny muted" htmlFor={editId}>
            Edit the draft
          </label>
          <textarea id={editId} value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
        </>
      ) : (
        <p className="draft">{card.body}</p>
      )}
      <p className="small" style={{ color: "var(--ink-2)" }}>
        <b>Why now:</b> {card.reason}
      </p>
      <div className="chips">
        {card.checks.map((check) => (
          <span className={`chip ${locked ? "warn" : "ok"}`} key={check}>
            {check}
          </span>
        ))}
      </div>
      <div className="acts">
        {locked ? (
          <button type="button" className="btn sm" onClick={() => decide({ decision: "approve" })} disabled={disabled}>
            I&apos;ll handle it
          </button>
        ) : editing ? (
          <>
            <button type="button" className="btn sm" onClick={approveEdited} disabled={disabled}>
              Approve edited version
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                setEditing(false);
                setDraft(card.body);
              }}
              disabled={disabled}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn sm" onClick={() => decide({ decision: "approve" })} disabled={disabled}>
              Approve: {card.action}
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                setDraft(card.body);
                setEditing(true);
              }}
              disabled={disabled}
            >
              Edit
            </button>
            <button type="button" className="btn sm ghost" onClick={() => decide({ decision: "skip" })} disabled={disabled}>
              Skip
            </button>
            {canRewrite && card.channel !== "list" && (
              <button type="button" className="linkbtn small" onClick={rewrite} disabled={disabled}>
                Rewrite in my voice
              </button>
            )}
          </>
        )}
      </div>
      {noteLine}
    </article>
  );
}
