import Link from "next/link";
import type { ReactNode } from "react";
import { businessHref, cardAnchor } from "@/components/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { SKILLS } from "@/lib/domain/agents";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import { sendTimeText } from "@/lib/domain/executor";
import type { AgentView } from "./view-model";
import styles from "./agents.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// An active agent's workspace, using the existing feed and Approvals queue.
// Previews never decide or send a card. Optional slots accept the separately
// supported Ask and customer views once their server capabilities are available.

/** State the recorded outcome without equating an approval with a delivered message. */
function outcome(card: CardRecord, entry: OutboxEntry | undefined): string {
  if (card.status === "skipped") return "Skipped";
  if (card.status === "superseded") return "Replaced by a newer draft";
  if (card.channel === "locked") return "Yours to handle";
  if (card.channel === "flag") return "Fact noted";
  if (entry?.delivery === "sent") return "Sent by Anchored";
  if (entry?.delivery === "failed") return `Didn't send${entry.note ? `: ${entry.note}` : ". Check Connections."}`;
  if (entry?.delivery === "sending") return "Sending now";
  if (entry?.delivery === "queued") return entry.note ?? `Waiting to send, ${sendTimeText(new Date(entry.sentAt))}`;
  if (entry?.channel === "list") return "Approved. See your outbox for the next step.";
  return "Approved. See your outbox for delivery details.";
}

/** Render an agent with its own previews and links to the one approval queue. */
export function AgentWorkspace({ businessId, agent, cards, outbox, ask, children }: {
  readonly businessId: string;
  readonly agent: AgentView;
  readonly cards: readonly CardRecord[];
  readonly outbox: readonly OutboxEntry[];
  readonly ask?: ReactNode;
  readonly children?: ReactNode;
}) {
  const waiting = cards.filter((card) => card.status === "pending");
  const recent = cards.filter((card) => card.status !== "pending").sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt)).slice(0, 10);
  const entries = new Map(outbox.map((entry) => [entry.cardId, entry]));
  const approvalsHref = businessHref(businessId, "approvals");
  const approveHref = (card: CardRecord) => `${approvalsHref}#${cardAnchor(card.key)}`;
  return (
    <div className={styles.workspace}>
      <nav aria-label="Breadcrumb"><Link href={businessHref(businessId, "workflows")}>Workflows</Link> / {agent.name}</nav>
      <PageHeader title={agent.name} description={agent.job} />
      <p className="prose">Anchored drafts the work. You review it in Approvals.</p>
      {children}
      <div className={styles.columns}>
        <section aria-labelledby="agent-waiting" className={styles.section}>
          <h2 id="agent-waiting">Waiting for your OK</h2>
          {waiting.length === 0 ? <p className="muted">Nothing waits for you here. New drafts appear when this agent has work to do.</p> : (
            <ul className={styles.drafts}>{waiting.map((card) => (
              <li key={card.key} className={styles.preview}>
                {card.example === true && <span className="badge">Example</span>}
                <h3>{card.title}</h3>
                {card.to && <p className="fine">For {card.to}</p>}
                <p className={styles.words}>{card.body}</p>
                {card.handoff && <p className="fine">Handed off: {card.handoff.reason}</p>}
                <ButtonLink href={approveHref(card)}>Review in Approvals</ButtonLink>
              </li>
            ))}</ul>
          )}
        </section>
        <section aria-labelledby="agent-ask" className={styles.section}>
          <h2 id="agent-ask">Ask {agent.name}</h2>
          {ask ?? <><p className="prose">For now, ask Anchored for a draft in Chat.</p><ButtonLink href={businessHref(businessId, "chat")} variant="secondary">Open Chat</ButtonLink></>}
        </section>
      </div>
      <section aria-labelledby="agent-recent" className={styles.section}>
        <h2 id="agent-recent">Recent activity</h2>
        {recent.length === 0 ? <p className="muted">No decisions yet.</p> : <ul className={styles.activity}>{recent.map((card) => (
          <li key={card.key}><Link href={approveHref(card)}>{card.title}</Link><span>{outcome(card, entries.get(card.id))}</span></li>
        ))}</ul>}
      </section>
      <details className={styles.details}>
        <summary>What {agent.name} handles</summary>
        <ul>{agent.skills.map((skill) => <li key={skill}><strong>{SKILLS[skill].name}.</strong> {SKILLS[skill].job}</li>)}</ul>
        {agent.never.length > 0 && <><h3>It never</h3><ul>{agent.never.map((limit) => <li key={limit}>{limit}</li>)}</ul></>}
      </details>
    </div>
  );
}
