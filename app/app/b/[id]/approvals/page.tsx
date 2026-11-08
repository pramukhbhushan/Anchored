import { CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import { AgentCard } from "@/components/business/AgentCard";
import { cardSource } from "@/components/agent-labels";
import { ResizablePanel } from "@/components/resize/ResizablePanel";
import { SendYourself } from "@/components/business/SendYourself";
import { SimulateButton } from "@/components/business/SimulateButton";
import { approvedDraft, handOff, type HandOff, type HandOffBusiness } from "@/components/business/handoff";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import { sendTimeText } from "@/lib/domain/executor";
import { activeAgents, agentName, chosenSkills } from "@/lib/domain/paths";
import { isAiConfigured } from "@/lib/server/ai";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Approvals: one reading column of the cards agents drafted, each with
// approve, edit and skip, then the decided ones as rows in a closed
// disclosure. In the right rail, pinned on wide screens, the outbox holds what
// the owner approved and what quiet hours are holding. Anchored isn't connected
// to texting or email, so each approved draft carries its send step: a link that
// opens the owner's own texting or email app, or text to copy and paste. Only
// the example business offers an example event.

export const metadata: Metadata = { title: "Approvals" };

const CHANNEL_LABEL: Readonly<Record<OutboxEntry["channel"], string>> = {
  sms: "Text",
  email: "Email",
  list: "Logged",
  telegram: "Telegram",
};

/** Return the outbox line for an email or list entry, from its card when the feed still has it. */
function logText(entry: OutboxEntry, card: CardRecord | undefined): string {
  if (card === undefined) return `${CHANNEL_LABEL[entry.channel]}: ${entry.to}`;
  return entry.channel === "email" ? `Email to ${entry.to}: ${card.title}` : `${card.action}: ${card.title}`;
}

/** Render one outbox entry: a text as a bubble, anything else as a log line, each with its send step once quiet hours allow. */
function OutboxItem({
  entry,
  card,
  queued,
  business,
}: {
  readonly entry: OutboxEntry;
  readonly card?: CardRecord;
  readonly queued: boolean;
  readonly business: HandOffBusiness;
}) {
  // A held text gets no send step yet: opening the texting app now would skip the quiet hours it waits for.
  const when = queued ? <small className="queued">Ready to send at {sendTimeText(new Date(entry.sentAt))}</small> : null;
  const draft = approvedDraft(entry, card);
  const step: HandOff | null = queued || draft === null ? null : handOff(draft, business);
  const send = step === null ? null : <SendYourself handOff={step} />;
  if (entry.channel === "sms") {
    return (
      <li className={`bubble${queued ? " is-queued" : ""}`}>
        <small>Text to {entry.to}</small>
        {entry.body}
        {when}
        {send}
      </li>
    );
  }
  return (
    <li className={`logline${queued ? " is-queued" : ""}`}>
      {logText(entry, card)}
      {/* A post or reply shows the words to paste; an email opens with its words already typed. */}
      {step?.kind === "copy" && <p className="handoff-text">{step.text}</p>}
      {when}
      {send}
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
  // Example events show a visitor how an agent drafts; an owner's own cards come from real events.
  const canSimulate = business.kind === "case" && chosenSkills(business, choices).length > 0;
  const canRewrite = isAiConfigured();
  const handOffBusiness: HandOffBusiness = { name: business.name, reach: business.reach, tools: business.tools };

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
      source={cardSource(c.agent === null ? null : agentName(business, c.agent))}
      canRewrite={canRewrite}
      business={handOffBusiness}
    />
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description={
          business.kind === "case"
            ? "Agents draft each text, email and post. Nothing goes out until you approve it."
            : // No connector is live yet, so every card here is an agent's sample.
              "Sample drafts from your agents. Nothing goes out until you approve it."
        }
        actions={
          <>
            <a className={buttonClass("quiet", "md", "only-narrow")} href="#outbox">
              See outbox
            </a>
            {canSimulate && <SimulateButton businessId={business.id} agentNames={agentNames} seeHref="#waiting" />}
          </>
        }
      />

      <div className="with-rail">
        <div className="feed">
          <SectionHeader id="waiting" title={`${waiting.length} waiting`} />
          {waiting.length > 0 ? (
            <div className="feed-list">{waiting.map(renderCard)}</div>
          ) : (
            <EmptyState icon={<CheckCheck size={22} />} title="You're all caught up">
              {canSimulate
                ? "New drafts land here as your agents work. Tap Watch an agent draft to see one arrive."
                : chosenSkills(business, choices).length > 0
                  ? "New drafts land here as your agents work."
                  : "On the Workflows page, let Anchored draft a job for your OK, and its drafts land here."}
            </EmptyState>
          )}
          {decided.length > 0 && (
            <details className="decided" id="decided">
              <summary>Decided ({decided.length})</summary>
              <div className="decided-list">{decided.map(renderCard)}</div>
            </details>
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
                <h2 id="outbox-title">Outbox</h2>
                <span>You send each one yourself</span>
              </div>
              {outbox.length === 0 ? (
                <p className="phone-empty">
                  Approve a card and it lands here. Each one opens your own texting or email app with the message typed out, or gives you the words to paste.
                </p>
              ) : (
                <>
                  {queued.length > 0 && (
                    <>
                      <p className="phone-label">Held for quiet hours</p>
                      <ul className="phone-list">
                        {queued.map((entry) => (
                          <OutboxItem key={entry.id} entry={entry} card={cardById.get(entry.cardId)} queued business={handOffBusiness} />
                        ))}
                      </ul>
                    </>
                  )}
                  {sent.length > 0 && (
                    <>
                      {queued.length > 0 && <p className="phone-label">Approved</p>}
                      <ul className="phone-list">
                        {sent.map((entry) => (
                          <OutboxItem key={entry.id} entry={entry} card={cardById.get(entry.cardId)} queued={false} business={handOffBusiness} />
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
