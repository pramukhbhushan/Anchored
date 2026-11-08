import { ChevronRight, Inbox, MessageSquare, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ExampleTour } from "@/components/business/ExampleTour";
import { SimulateButton } from "@/components/business/SimulateButton";
import { NEW_BUSINESS_HREF, businessHref, cardAnchor } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { feedStats, money, placeOf } from "@/components/view-helpers";
import { whoHandles } from "@/components/workflows/flow";
import { newForOwner, samplesWaiting, stakeWaiting } from "@/lib/domain/brief";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import { activeAgents, chosenSkills, stackCost, workflowIdsOf } from "@/lib/domain/paths";
import { groupByStage } from "@/lib/domain/stages";
import { WORKFLOWS } from "@/lib/domain/workflows";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The overview, the page an owner opens each day: the morning brief on the
// carbon work-order slip, then a ledger of every workflow and who handles it. The
// example business opens with four stops for a first visitor. The brief leads with how
// many approvals wait and links each one, then says what rides on them, what
// is new, what the stack costs and, once there is any, what the owner has done.

export const metadata: Metadata = { title: "Overview" };

// Waiting cards the brief names one per row; the rest are counted.
const ROWS_SHOWN = 5;

/** Today's date as the brief's header prints it, such as "Saturday, Nov 7". */
function briefDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: OWNER_TIME_ZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** Join names as English prose: "A", "A and B", "A, B and C". */
function joinAnd(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Render the overview for the business in the URL. */
export default async function OverviewPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, feed] = await Promise.all([getChoices(business), getFeed(business)]);
  const stats = feedStats(feed.cards);
  const waiting = feed.cards.filter((card) => card.status === "pending");
  // An example's dollar figure is made up to show the card, so only real drafts count toward what rides on today.
  const atStake = stakeWaiting(feed.cards);
  const samples = samplesWaiting(feed.cards);
  const cost = stackCost(business, choices);
  const onQuote = cost.onQuote.length > 0 ? `, plus ${joinAnd(cost.onQuote.map((tool) => tool.name))} on quote` : "";
  const fresh = newForOwner(business, choices);
  const [onlyFresh] = fresh;
  const freshHref =
    fresh.length === 1 && onlyFresh !== undefined
      ? `${businessHref(business.id, "workflows")}#wf-${onlyFresh}`
      : businessHref(business.id, "workflows");
  const approvalsHref = businessHref(business.id, "approvals");
  const workflowsHref = businessHref(business.id, "workflows");
  const place = placeOf(business);
  // Example events show a visitor how an agent drafts; an owner's own cards come from real events.
  const canSimulate = business.kind === "case" && chosenSkills(business, choices).length > 0;
  const agentNames = Object.fromEntries(activeAgents(business, choices).map((a) => [a.id, a.name]));

  return (
    <div className="ov">
      <PageHeader
        title={business.name}
        description={place === null ? business.trade : `${business.trade} in ${place}`}
        actions={
          // The example's chat can't change anything, so the example leads with what a visitor can do next instead.
          business.kind === "case" ? (
            <ButtonLink href={NEW_BUSINESS_HREF} variant="secondary">
              <Plus aria-hidden="true" size={16} />
              Set up your business
            </ButtonLink>
          ) : (
            <ButtonLink href={businessHref(business.id, "chat")} variant="secondary">
              <MessageSquare aria-hidden="true" size={16} />
              Open chat
            </ButtonLink>
          )
        }
      />

      {business.kind === "case" && <ExampleTour businessId={business.id} />}

      <section className="slip" aria-labelledby="brief-title">
        <header className="slip-head">
          <h2 id="brief-title">Morning brief</h2>
          <span>{briefDate()}</span>
        </header>
        <div className="slip-perf" aria-hidden="true" />
        <div className="brief">
          <div className="brief-top">
            {waiting.length > 0 ? (
              <>
                <p className="brief-count">
                  <b>{waiting.length}</b> {waiting.length === 1 ? "draft waits for you" : "drafts wait for you"}
                </p>
                <ButtonLink href={approvalsHref}>
                  <Inbox aria-hidden="true" size={16} />
                  Review {waiting.length === 1 ? "it" : `all ${waiting.length}`}
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="brief-none">Nothing waits for you.</p>
                {canSimulate && <SimulateButton businessId={business.id} agentNames={agentNames} seeHref={approvalsHref} />}
              </>
            )}
          </div>
          {waiting.length > 0 && (
            <ul className="brief-rows" aria-label="Waiting for you">
              {waiting.slice(0, ROWS_SHOWN).map((card) => (
                <li key={card.key}>
                  <Link href={`${approvalsHref}#${cardAnchor(card.key)}`}>
                    {card.title}
                    <ChevronRight aria-hidden="true" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {waiting.length > ROWS_SHOWN && <p className="brief-more">and {waiting.length - ROWS_SHOWN} more</p>}

          <ul className="brief-lines">
            {/* An owner's starters are tagged as examples; the example business is understood as one as a whole. */}
            {samples > 0 && (
              <li>
                <span>
                  {samples === waiting.length ? "These drafts are samples" : `${samples} of these drafts are samples`}. Real ones come from your calls, texts and email
                  once you connect them.
                </span>
                <Link href={businessHref(business.id, "connections")}>See connections</Link>
              </li>
            )}
            {atStake > 0 && <li>{money(atStake)} rides on today&apos;s cards.</li>}
            {fresh.length > 0 && (
              <li>
                <span>New for you: {joinAnd(fresh.map((id) => WORKFLOWS[id].name))}.</span>
                <Link href={freshHref}>{fresh.length === 1 ? "See workflow" : "See workflows"}</Link>
              </li>
            )}
            <li>
              <span>
                Your stack costs {money(cost.total)} a month{onQuote}.
              </span>
              <Link href={businessHref(business.id, "stack")}>See stack</Link>
            </li>
            {stats.approved > 0 && (
              <li>
                So far: {stats.approved} approved, {stats.edited} edited
                {stats.actedOn > 0 ? `, ${money(stats.actedOn)} acted on` : ""}.
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="ov-wf" aria-labelledby="ov-wf-title">
        <div className="ov-wf-head">
          <h2 id="ov-wf-title">Your workflows</h2>
          <Link href={workflowsHref}>See how work moves</Link>
        </div>
        <ul className="ov-wf-list">
          {groupByStage(workflowIdsOf(business))
            .flatMap((group) => group.workflows)
            .map((workflow) => {
              const handler = whoHandles(business, choices, workflow);
              return (
                <li key={workflow}>
                  <Link href={`${workflowsHref}#wf-${workflow}`}>
                    <span>{WORKFLOWS[workflow].name}</span>
                    <span className="ov-who" data-kind={handler.kind}>
                      <span className="sr">, </span>
                      {handler.short}
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}
