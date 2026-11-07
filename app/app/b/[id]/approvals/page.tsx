import { CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import { AgentCard } from "@/components/AgentCard";
import { cardSource } from "@/components/agent-labels";
import { ResizablePanel } from "@/components/resize/ResizablePanel";
import { SampleBadge } from "@/components/SampleBadge";
import { SimulateButton } from "@/components/SimulateButton";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { DEMO_TIME_ZONE } from "@/components/view-helpers";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import { activeAgents, agentName, chosenSkills } from "@/lib/domain/paths";
import { isAiConfigured } from "@/lib/server/ai";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Approvals: the cards agents drafted, waiting ones first, each with approve,
// edit and skip, then the decided ones; the feed adds columns as width grows.
// In the right rail, pinned on wide screens, the demo outbox shows what was
// sent and what quiet hours are holding.

export const metadata: Metadata = { title: "Approvals" };

const CHANNEL_LABEL: Readonly<Record<OutboxEntry["channel"], string>> = {
  sms: "Text",
  email: "Email",
  list: "Logged",
};

/** Return a queued send's time, such as "Mon 8:00 AM", in the time zone quiet hours use. */
function sendTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Return the outbox line for an email or list entry, from its card when the feed still has it. */
function logText(entry: OutboxEntry, card: CardRecord | undefined): string {
  if (card === undefined) return `${CHANNEL_LABEL[entry.channel]}: ${entry.to}`;
  return entry.channel === "email" ? `Email to ${entry.to}: ${card.title}` : `${card.action}: ${card.title}`;
}

/** Render one outbox entry: a text as a bubble, anything else as a log line. */
function OutboxItem({
  entry,
  card,
  queued,
}: {
  readonly entry: OutboxEntry;
  readonly card?: CardRecord;
  readonly queued: boolean;
}) {
  const when = queued ? <small className="queued">Queued for {sendTime(entry.sentAt)}</small> : null;
  if (entry.channel === "sms") {
    return (
      <li className={`bubble${queued ? " is-queued" : ""}`}>
        <small>Text to {entry.to}</small>
        {entry.body}
        {when}
      </li>
    );
  }
  return (
    <li className={`logline${queued ? " is-queued" : ""}`}>
      {logText(entry, card)}
      {when}
    </li>
  );
}

/** Render the approvals feed and the outbox for the business in the URL. */
export default async function ApprovalsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, feed] = await Promise.all([getChoices(business), getFeed(business)]);
  const agents = activeAgents(business, choices);
  const agentNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const canSimulate = chosenSkills(business, choices).length > 0;
  const canRewrite = isAiConfigured();

  const waiting = feed.cards.filter((c) => c.status === "pending");
  const decided = feed.cards.filter((c) => c.status !== "pending");
  const cardById = new Map(feed.cards.map((c) => [c.id, c]));
  const now = new Date().toISOString();
  // Newest first, as a phone stacks new messages on top. ISO timestamps sort as strings.
  const outbox = [...feed.outbox].sort((a, z) => z.sentAt.localeCompare(a.sentAt));
  // A send time still ahead means quiet hours are holding it.
  const queued = outbox.filter((entry) => entry.sentAt > now).reverse();
  const sent = outbox.filter((entry) => entry.sentAt <= now);

  const renderCard = (c: CardRecord) => (
    // `key`, not `id`: a draft's id changes when it is first decided, and remounting would drop the card's note.
    <AgentCard
      key={c.key}
      card={c}
      source={cardSource(c.agent === null ? null : agentName(business, c.agent), c.skill)}
      canRewrite={canRewrite}
    />
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        badge={<SampleBadge business={business} />}
        description="Your agents draft, you decide. Nothing goes out until you approve it, and Anchored checks your rules, such as quiet hours, before anything is sent."
        actions={
          <>
            <a className={buttonClass("secondary", "md", "only-narrow")} href="#outbox">
              See outbox
            </a>
            {canSimulate && <SimulateButton businessId={business.id} agentNames={agentNames} seeHref="#waiting" />}
          </>
        }
      />

      <div className="agent-row">
        <span>Drafting for you:</span>
        <span className="badges">
          {agents.map((agent) => (
            <Badge tone={agent.niche ? "new" : "neutral"} key={agent.id}>
              {agent.name}
            </Badge>
          ))}
        </span>
      </div>

      <div className="with-rail">
        <div className="feed">
          <SectionHeader id="waiting" title={`Waiting on you (${waiting.length})`} />
          {waiting.length > 0 ? (
            <div className="feed-list">{waiting.map(renderCard)}</div>
          ) : (
            <EmptyState icon={<CheckCheck size={22} />} title="You're all caught up">
              {canSimulate
                ? "New drafts land here as your agents work. Simulate a new event to see one arrive."
                : "Choose Build on a workflow and its agent starts drafting here."}
            </EmptyState>
          )}
          {decided.length > 0 && (
            <>
              <SectionHeader id="decided" title={`Decided (${decided.length})`} />
              <div className="feed-list">{decided.map(renderCard)}</div>
            </>
          )}
        </div>

        <ResizablePanel
          storageKey="approvals-outbox"
          side="left"
          defaultWidth={380}
          min={300}
          max={600}
          label="Resize outbox"
          className="outbox-panel"
        >
          <aside className="rail outbox" id="outbox" aria-labelledby="outbox-title">
            <div className="phone">
              <div className="phone-bar">
                <h2 id="outbox-title">Demo outbox</h2>
                <span>Nothing leaves Anchored</span>
              </div>
              {outbox.length === 0 ? (
                <p className="phone-empty">
                  Approve a card and it lands here. In a live account it goes out from your own number or email.
                </p>
              ) : (
                <>
                  {queued.length > 0 && (
                    <>
                      <p className="phone-label">Held for quiet hours</p>
                      <ul className="phone-list">
                        {queued.map((entry) => (
                          <OutboxItem key={entry.id} entry={entry} card={cardById.get(entry.cardId)} queued />
                        ))}
                      </ul>
                    </>
                  )}
                  {sent.length > 0 && (
                    <>
                      {queued.length > 0 && <p className="phone-label">Sent</p>}
                      <ul className="phone-list">
                        {sent.map((entry) => (
                          <OutboxItem key={entry.id} entry={entry} card={cardById.get(entry.cardId)} queued={false} />
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          </aside>
        </ResizablePanel>
      </div>
    </>
  );
}
