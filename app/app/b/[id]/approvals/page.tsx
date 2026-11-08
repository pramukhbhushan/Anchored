import { CheckCheck, Plug } from "lucide-react";
import type { Metadata } from "next";
import { AgentCard } from "@/components/business/AgentCard";
import { OpenFromHash } from "@/components/business/OpenFromHash";
import { cardSource } from "@/components/agent-labels";
import { businessHref } from "@/components/routes";
import { ResizablePanel } from "@/components/resize/ResizablePanel";
import { SendYourself } from "@/components/business/SendYourself";
import { SimulateButton } from "@/components/business/SimulateButton";
import { WritingStarters } from "@/components/business/WritingStarters";
import { approvedDraft, handOff, type ApprovedDraft, type HandOff, type HandOffBusiness } from "@/components/business/handoff";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
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
// the owner approved and what quiet hours are holding. Anchored sends a draft
// itself through a connected service and says so; a draft it won't or couldn't
// send carries the owner's send step: a link that opens their own texting or
// email app, or text to copy and paste. An owner's starters are examples until
// a connected channel brings real drafts; with neither, the page points to
// Connections. Only the example business offers an example event.

export const metadata: Metadata = { title: "Approvals" };

type DisplayEntry = Omit<OutboxEntry, "channel"> & Pick<ApprovedDraft, "channel">;

const CHANNEL_LABEL: Readonly<Record<DisplayEntry["channel"], string>> = {
  sms: "Text",
  email: "Email",
  list: "Logged",
  telegram: "Telegram message",
};

/** Report whether a delivery renders its message body instead of a list action. */
function isMessage(channel: string): boolean {
  return channel === "sms" || channel === "telegram";
}

/** Return the outbox line for an email or list entry, from its card when the feed still has it. */
function logText(entry: DisplayEntry, card: CardRecord | undefined): string {
  if (card === undefined) return `${CHANNEL_LABEL[entry.channel]}: ${entry.to}`;
  return entry.channel === "email" ? `Email to ${entry.to}: ${card.title}` : `${card.action}: ${card.title}`;
}

/** Say where one outbox entry stands, or `null` when the owner sends it and there is nothing to add. */
function deliveryLine(entry: DisplayEntry, held: boolean): string | null {
  if (entry.delivery === "sent") return "Sent by Anchored";
  if (entry.delivery === "failed") {
    if (entry.channel === "telegram") return entry.note === null ? "Didn't send. Check the Telegram connection." : `Didn't send: ${entry.note} Check the Telegram connection.`;
    return entry.note === null ? "Didn't send. Send it yourself." : `Didn't send: ${entry.note}`;
  }
  if (held) return `Ready to send at ${sendTimeText(new Date(entry.sentAt))}`;
  if (entry.delivery === "sending") return "Sending now";
  // Due but not yet picked up: the scheduled sender takes it on its next run, so nothing has gone out yet.
  if (entry.delivery === "queued") return "Waiting for Anchored to send it";
  return entry.note;
}

/** Render one outbox entry: a text as a bubble, anything else as a log line, each with its send step when the owner sends it. */
/** Say what authorized an entry no card tap approved: the owner's acknowledgment rule, or the bot's fixed answer. */
function ruleLine(entry: DisplayEntry): string | null {
  if (entry.rule === "acknowledge") return entry.delivery === "sent" ? "Sent under your acknowledgment rule" : "Under your acknowledgment rule";
  if (entry.rule === "protocol") return "The bot's fixed answer to the customer's /start or /stop";
  return null;
}

function OutboxItem({
  entry,
  card,
  queued,
  business,
}: {
  readonly entry: DisplayEntry;
  readonly card?: CardRecord;
  readonly queued: boolean;
  readonly business: HandOffBusiness;
}) {
  const held = queued && (entry.delivery === "yours" || entry.delivery === "queued");
  const line = deliveryLine(entry, held);
  const when = line === null ? null : <small className="queued">{line}</small>;
  // The owner sends only what Anchored won't or couldn't. A held text gets no send step yet:
  // opening the texting app now would skip the quiet hours it waits for.
  const ownerSends = entry.delivery === "failed" || (entry.delivery === "yours" && !held);
  const draft = approvedDraft(entry, card);
  const step: HandOff | null = !ownerSends || draft === null ? null : handOff(draft, business);
  const send = step === null ? null : <SendYourself handOff={step} />;
  if (isMessage(entry.channel)) {
    return (
      <li className={`bubble${held ? " is-queued" : ""}`}>
        <small>{CHANNEL_LABEL[entry.channel]} to {entry.to}</small>
        {entry.body}
        {ruleLine(entry) !== null && <small>{ruleLine(entry)}</small>}
        {when}
        {entry.channel === "telegram" && entry.delivery === "failed" && <a href={businessHref(entry.businessId, "connections")}>See connections</a>}
        {send}
      </li>
    );
  }
  return (
    <li className={`logline${held ? " is-queued" : ""}`}>
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
  // The subtitle calls the drafts examples only while an example still waits; once they're cleared it would be false.
  const showsExamples = business.kind === "custom" && !feed.examplesHidden && waiting.some((c) => c.example === true);
  const decided = feed.cards.filter((c) => c.status !== "pending");
  const cardById = new Map(feed.cards.map((c) => [c.id, c]));
  const now = new Date().toISOString();
  // Newest first, as a phone stacks new messages on top. ISO timestamps sort as strings.
  const outbox = [...feed.outbox].sort((a, z) => z.sentAt.localeCompare(a.sentAt));
  // A send time still ahead means quiet hours are holding it.
  const queued = outbox.filter((entry) => entry.sentAt > now).reverse();
  const sent = outbox.filter((entry) => entry.sentAt <= now);
  // An entry Anchored took on means a service is connected, so the owner no longer sends every one.
  const anchoredSends = outbox.some((entry) => entry.delivery !== "yours");

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
      <OpenFromHash />
      <PageHeader
        title="Approvals"
        description={
          showsExamples
            ? "Example drafts from your agents. Nothing goes out until you approve it."
            : "Agents draft each text, email and post. Nothing goes out until you approve it."
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
          {feed.writingStarters && <WritingStarters businessName={business.name} />}
          {waiting.length > 0 ? (
            <div className="feed-list">{waiting.map(renderCard)}</div>
          ) : business.kind === "custom" && !feed.connected ? (
            <EmptyState
              icon={<Plug size={22} />}
              title="Connect a phone or inbox to see real drafts"
              actions={
                <ButtonLink href={businessHref(business.id, "connections")}>Set up a connection</ButtonLink>
              }
            >
              The examples are done. Once your texting number or email is connected, drafts for real customers land here.
            </EmptyState>
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
                <span>{anchoredSends ? "Anchored sends what it can" : "You send each one yourself"}</span>
              </div>
              {outbox.length === 0 ? (
                <p className="phone-empty">
                  Approve a card and it lands here, with who sends it. Anchored sends through the texting and email you connect. Anything else opens your own
                  texting or email app with the message typed out, or gives you the words to paste.
                </p>
              ) : (
                <>
                  {queued.length > 0 && (
                    <>
                      <p className="phone-label">Held for quiet hours</p>
                      <ul className="phone-list">
                        {queued.map((entry) => (
                          <OutboxItem key={entry.id} entry={entry} card={entry.cardId === null ? undefined : cardById.get(entry.cardId)} queued business={handOffBusiness} />
                        ))}
                      </ul>
                    </>
                  )}
                  {sent.length > 0 && (
                    <>
                      {queued.length > 0 && <p className="phone-label">Approved</p>}
                      <ul className="phone-list">
                        {sent.map((entry) => (
                          <OutboxItem key={entry.id} entry={entry} card={entry.cardId === null ? undefined : cardById.get(entry.cardId)} queued={false} business={handOffBusiness} />
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
