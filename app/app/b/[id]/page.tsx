import { Bot, Inbox, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { asSentence, skillList } from "@/components/agent-labels";
import { ProfileSummary } from "@/components/business/ProfileCard";
import { businessHref } from "@/components/routes";
import { SampleBadge } from "@/components/business/SampleBadge";
import { SimulateButton } from "@/components/business/SimulateButton";
import { Stamp } from "@/components/ui/Stamp";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat, StatStrip } from "@/components/ui/Stat";
import { feedStats, money, placeOf, plannedWorkflows } from "@/components/view-helpers";
import { morningBrief } from "@/lib/domain/brief";
import { DEMO_TIME_ZONE } from "@/lib/domain/executor";
import { activeAgents, chosenSkills, stackCost } from "@/lib/domain/paths";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { ActiveAgent, BusinessProfile } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The overview, the page an owner opens each day. The main column holds the
// morning brief on the carbon work-order slip, a KPI strip, workflows new for
// the business and the agents drafting for it; the rail holds approvals
// waiting and the profile. On one column, approvals follow the brief.

export const metadata: Metadata = { title: "Overview" };

/** Today's date as the brief's header prints it, such as "Friday, Nov 7". */
function briefDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: DEMO_TIME_ZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** Return the sentence saying why a niche agent exists, or `null` for a core agent. */
function spawnReason(business: BusinessProfile, agent: ActiveAgent): string | null {
  if (!agent.niche) return null;
  const niche = business.nicheAgents.find((n) => n.id === agent.id);
  return niche === undefined ? null : asSentence(niche.spawnedBecause);
}

/** Render the overview for the business in the URL. */
export default async function OverviewPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, feed] = await Promise.all([getChoices(business), getFeed(business)]);
  const stats = feedStats(feed.cards);
  const brief = morningBrief(business, choices, feed.cards);
  const cost = stackCost(business, choices);
  const agents = activeAgents(business, choices);
  const agentNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const fresh = plannedWorkflows(business).filter((w) => w.plan.isNew);
  const firstUp = feed.cards.find((card) => card.status === "pending");
  const place = placeOf(business);

  return (
    <>
      <PageHeader
        title={business.name}
        badge={<SampleBadge business={business} />}
        description={`${business.trade}${place === null ? "" : ` in ${place}`}.`}
        actions={
          <ButtonLink href={businessHref(business.id, "chat")} variant="secondary">
            <MessageSquare aria-hidden="true" size={16} />
            Open chat
          </ButtonLink>
        }
      />

      <div className="with-rail ov-page">
        <div className="ov-main">
          <section className="slip" aria-labelledby="brief-title">
            <header className="slip-head">
              <h2 id="brief-title">Morning brief</h2>
              <span>{briefDate()}</span>
            </header>
            <div className="slip-perf" aria-hidden="true" />
            <ul className="slip-lines">
              {brief.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <StatStrip label="This business so far">
            <Stat label="Approved" value={stats.approved} hint="Cards you sent or logged" />
            <Stat label="Edit rate" value={`${stats.editRate}%`} hint="Approvals you edited first" />
            <Stat
              label="Value acted on"
              value={money(stats.actedOn)}
              hint="Quotes and invoices on cards you approved"
            />
            <Stat
              label="Stack cost"
              value={`${money(cost.total)}/mo`}
              hint={
                cost.onQuote.length > 0
                  ? `Plus ${cost.onQuote.length} on quote`
                  : "Tools you already pay for count as $0"
              }
            />
          </StatStrip>

          <div className="ov-pair">
            <Card
              title="New for you"
              description="Work your answers point to that this business doesn't do today."
              action={
                <Link className="btn btn-quiet btn-sm" href={businessHref(business.id, "workflows")}>
                  All workflows
                </Link>
              }
            >
              {fresh.length === 0 ? (
                <p className="muted">
                  Nothing new right now. Tell Anchored about work you want help with in chat, and it shows up here.
                </p>
              ) : (
                <ul className="ov-list">
                  {fresh.map((w) => (
                    <li key={w.id}>
                      <div>
                        <Link href={`${businessHref(business.id, "workflows")}#wf-${w.id}`}>
                          <b>{WORKFLOWS[w.id].name}</b>
                        </Link>
                        <p>{w.plan.why}</p>
                      </div>
                      <Stamp path={choices[w.id].path} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Agents drafting for you"
              description="Each one drafts cards and waits for your approval."
              action={
                <Link className="btn btn-quiet btn-sm" href={businessHref(business.id, "stack")}>
                  How they work
                </Link>
              }
            >
              <ul className="agents">
                {agents.map((agent) => {
                  const reason = spawnReason(business, agent);
                  return (
                    <li key={agent.id} className={agent.niche ? "agent niche" : "agent"}>
                      <span className="agent-icon" aria-hidden="true">
                        <Bot size={18} />
                      </span>
                      <div>
                        <p className="agent-name">
                          <b>{agent.name} agent</b>
                          {agent.niche && <Badge tone="new">Spawned for you</Badge>}
                        </p>
                        <p className="agent-skills">
                          {agent.skills.length > 0 ? skillList(agent.skills) : "Waiting for a workflow on Build"}
                        </p>
                        {reason !== null && <p className="agent-why">{reason}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>

        <aside className="rail" aria-label="Approvals and profile">
          <Card className="waiting" title="Approvals" level={2}>
            <p className="waiting-count">
              <b>{stats.pending}</b> {stats.pending === 1 ? "waits for you" : "wait for you"}
            </p>
            {firstUp !== undefined ? (
              <p className="waiting-first">
                First up: <b>{firstUp.title}</b>
              </p>
            ) : (
              <p className="waiting-first">Nothing waits for you. New drafts land here as your agents work.</p>
            )}
            <div className="waiting-acts">
              {stats.pending > 0 ? (
                <ButtonLink href={businessHref(business.id, "approvals")}>
                  <Inbox aria-hidden="true" size={16} />
                  Review {stats.pending === 1 ? "it" : `all ${stats.pending}`}
                </ButtonLink>
              ) : (
                chosenSkills(business, choices).length > 0 && (
                  <SimulateButton
                    businessId={business.id}
                    agentNames={agentNames}
                    seeHref={businessHref(business.id, "approvals")}
                  />
                )
              )}
            </div>
          </Card>
          <ProfileSummary business={business} />
        </aside>
      </div>
    </>
  );
}
