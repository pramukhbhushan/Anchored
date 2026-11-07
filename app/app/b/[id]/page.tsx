import { ChevronRight, Inbox, MessageSquare, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SimulateButton } from "@/components/business/SimulateButton";
import { NEW_BUSINESS_HREF, businessHref, cardAnchor } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stamp } from "@/components/ui/Stamp";
import { feedStats, money, placeOf, plannedWorkflows } from "@/components/view-helpers";
import { DEMO_TIME_ZONE } from "@/lib/domain/executor";
import { activeAgents, chosenSkills, stackCost } from "@/lib/domain/paths";
import { WORKFLOWS } from "@/lib/domain/workflows";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The overview, the page an owner opens each day: the morning brief on the
// carbon work-order slip, then a ledger of every workflow and its path. The brief leads with how
// many approvals wait and links each one, then says what rides on them, what
// is new, what the stack costs and, once there is any, what the owner has done.

export const metadata: Metadata = { title: "Overview" };

// Waiting cards the brief names one per row; the rest are counted.
const ROWS_SHOWN = 5;

/** Today's date as the brief's header prints it, such as "Saturday, Nov 7". */
function briefDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: DEMO_TIME_ZONE,
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
  const atStake = waiting.reduce((sum, card) => sum + (card.stake ?? 0), 0);
  const cost = stackCost(business, choices);
  const onQuote = cost.onQuote.length > 0 ? `, plus ${joinAnd(cost.onQuote.map((tool) => tool.name))} on quote` : "";
  // Same rule as the morning brief in `lib/domain/brief.ts`: new workflows the owner hasn't skipped.
  const fresh = plannedWorkflows(business).filter((w) => w.plan.isNew && choices[w.id].path !== "skip");
  const [onlyFresh] = fresh;
  const freshHref =
    fresh.length === 1 && onlyFresh !== undefined
      ? `${businessHref(business.id, "workflows")}#wf-${onlyFresh.id}`
      : businessHref(business.id, "workflows");
  const approvalsHref = businessHref(business.id, "approvals");
  const workflowsHref = businessHref(business.id, "workflows");
  const place = placeOf(business);
  const canSimulate = chosenSkills(business, choices).length > 0;
  const agentNames = Object.fromEntries(activeAgents(business, choices).map((a) => [a.id, a.name]));

  return (
    <div className="ov">
      <PageHeader
        title={business.name}
        description={place === null ? business.trade : `${business.trade} in ${place}`}
        actions={
          // A sample's chat can't change anything, so a sample leads with what a visitor can do next instead.
          business.kind === "case" ? (
            <ButtonLink href={NEW_BUSINESS_HREF} variant="secondary">
              <Plus aria-hidden="true" size={16} />
              Start your own business
            </ButtonLink>
          ) : (
            <ButtonLink href={businessHref(business.id, "chat")} variant="secondary">
              <MessageSquare aria-hidden="true" size={16} />
              Open chat
            </ButtonLink>
          )
        }
      />

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
                  <b>{waiting.length}</b> {waiting.length === 1 ? "waits for you" : "wait for you"}
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
            {atStake > 0 && <li>{money(atStake)} rides on today&apos;s cards.</li>}
            {fresh.length > 0 && (
              <li>
                <span>New this week: {joinAnd(fresh.map((w) => WORKFLOWS[w.id].name))}.</span>
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
          <Link href={workflowsHref}>Change paths</Link>
        </div>
        <ul className="ov-wf-list">
          {plannedWorkflows(business).map((w) => (
            <li key={w.id}>
              <Link href={`${workflowsHref}#wf-${w.id}`}>
                <span>{WORKFLOWS[w.id].name}</span>
                <Stamp path={choices[w.id].path} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
