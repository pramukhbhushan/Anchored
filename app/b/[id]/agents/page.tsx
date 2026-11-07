import type { Metadata } from "next";
import { AgentCard } from "@/components/AgentCard";
import { cardSource } from "@/components/agent-labels";
import { SimulateButton } from "@/components/SimulateButton";
import { money } from "@/components/view-helpers";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import { morningBrief } from "@/lib/domain/brief";
import { activeAgents, agentName, chosenSkills } from "@/lib/domain/paths";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";
import { isAiConfigured } from "@/lib/server/ai";

// =============================================================================
// Module Overview
// =============================================================================
// Step 5, agents at work: the morning brief, four KPIs, the active agents, the
// card feed with its approve, edit and skip actions, and the simulated outbox
// phone where approved texts and logged emails land.

export const metadata: Metadata = { title: "Agents at work" };

/** Return the outbox line the prototype showed for an approved email or list card. */
function logText(entry: OutboxEntry, card: CardRecord | undefined): string {
  if (card === undefined) return entry.body;
  return entry.channel === "email" ? `Email to ${entry.to}: ${card.title}` : `${card.action}: ${card.title}`;
}

/** Render the agents view for the business in the URL. */
export default async function AgentsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, feed] = await Promise.all([getChoices(business), getFeed(business)]);
  const agents = activeAgents(business, choices);
  const canSimulate = chosenSkills(business, choices).length > 0;
  const canRewrite = isAiConfigured();

  const { cards } = feed;
  const pending = cards.filter((c) => c.status === "pending");
  const approved = cards.filter((c) => c.status === "approved");
  const editedShare = approved.length > 0 ? Math.round((approved.filter((c) => c.edited).length / approved.length) * 100) : 0;
  const actedOn = approved.reduce((sum, c) => sum + (c.stake ?? 0), 0);
  const brief = morningBrief(business, choices, cards);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  // Newest first, as the prototype's phone stacked new messages on top.
  const outbox = [...feed.outbox].sort((a, z) => z.sentAt.localeCompare(a.sentAt));
  const agentNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Agents at work</h2>
          <p>
            Your agents run a skill for each workflow where you chose Build, and Internal Communications always runs.
            Each skill drafts a card. You approve, edit or skip it, and plain code sends only what you approved, after
            checking your rules.
          </p>
        </div>
        <div className="row">
          {canSimulate && <SimulateButton businessId={business.id} agentNames={agentNames} />}
        </div>
      </div>

      <div className="brief">
        <h3>Morning brief</h3>
        <ul>
          {brief.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="kpis">
        <div>
          <b>{pending.length}</b>
          <span>Waiting on you</span>
        </div>
        <div>
          <b>{approved.length}</b>
          <span>Approved</span>
        </div>
        <div>
          <b>{editedShare}%</b>
          <span>Edited before approval</span>
        </div>
        <div>
          <b>{money(actedOn)}</b>
          <span>Acted on</span>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <b className="small">Your agents</b>
        <div className="chips">
          {agents.map((agent) => (
            <span className={`chip${agent.niche ? " new" : ""}`} key={agent.id}>
              {agent.name}
            </span>
          ))}
        </div>
      </div>

      <div className="cols">
        <div className="feed">
          {cards.length > 0 ? (
            cards.map((card) => (
              <AgentCard
                key={card.id}
                card={card}
                source={cardSource(card.agent === null ? null : agentName(business, card.agent), card.skill)}
                canRewrite={canRewrite}
              />
            ))
          ) : (
            <p className="panel">No agents yet. Choose Build on a workflow and its agent starts here.</p>
          )}
        </div>
        <aside className="stack-y">
          <div className="phone" role="region" aria-label="Simulated outbox">
            <div className="bar">
              <span>Simulated outbox</span>
              <span>Nothing is really sent</span>
            </div>
            {outbox.length > 0 ? (
              outbox.map((entry) =>
                entry.channel === "sms" ? (
                  <div className="bubble" key={entry.id}>
                    <small>Text to {entry.to}</small>
                    {entry.body}
                  </div>
                ) : (
                  <div className="logline" key={entry.id}>
                    {logText(entry, cardById.get(entry.cardId))}
                  </div>
                ),
              )
            ) : (
              <p className="empty">
                Approve a card and it lands here. In a real account it goes out from your own number or email.
              </p>
            )}
          </div>
          <p className="tiny muted">
            We count edits, skips and dollars acted on, not &quot;hours saved&quot;. A count of taps can&apos;t prove
            anyone saved time.
          </p>
        </aside>
      </div>
    </>
  );
}
