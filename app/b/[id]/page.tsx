import type { Metadata } from "next";
import Link from "next/link";
import { asSentence } from "@/components/agent-labels";
import { businessHref } from "@/components/routes";
import { plannedWorkflows } from "@/components/view-helpers";
import { BASE_WORKFLOWS, WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile } from "@/lib/domain/types";
import { getBusinessOrNotFound } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Step 1, the business profile: the context layer every agent reads, the
// workflows it produced, any niche agents onboarding spawned, and a notice
// saying who wrote it, Claude, Anchored's rules or our research.

export const metadata: Metadata = { title: "Your business" };

/** Say who wrote this profile and how far to trust it. */
function authorship(business: BusinessProfile): string {
  if (business.builtBy === "claude") return "Built by Claude from your answers. Check each line before you rely on it.";
  if (business.kind === "custom") return "Mapped from your answers by Anchored's rules.";
  return "Case study written from our research. Numbers marked modeled are arithmetic on research ranges, not measurements.";
}

/** Render the profile for the business in the URL. */
export default async function ProfilePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const planned = plannedWorkflows(business);
  const added = planned.filter((w) => !WORKFLOWS[w.id].base);
  const fresh = planned.filter((w) => w.plan.isNew).map((w) => WORKFLOWS[w.id].name);
  const custom = business.kind === "custom";

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Here&apos;s your business</h2>
          <p>
            This profile is the context layer. Every agent reads it, so nobody re-explains the business.{" "}
            {custom
              ? "Fix anything that's wrong before it counts."
              : "This is a case study. Add your own business to see Anchored map it from your answers."}
          </p>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/onboard">
            Add your business
          </Link>
          <Link className="btn" href={businessHref(business.id, "workflows")}>
            See your workflows
          </Link>
        </div>
      </div>
      <div className="cols">
        <div className="panel">
          <dl className="kv">
            <dt>Business</dt>
            <dd>{business.trade}</dd>
            <dt>Where</dt>
            <dd>{business.place}</dd>
            <dt>Size</dt>
            <dd>{business.size}</dd>
            <dt>Revenue</dt>
            <dd>{business.revenue}</dd>
            <dt>Customers</dt>
            <dd>{business.customers}</dd>
            <dt>Languages</dt>
            <dd>{business.languages.join(", ")}</dd>
            <dt>How they reach you</dt>
            <dd>
              <div className="chips">
                {business.reach.map((r) => (
                  <span className="chip" key={r}>
                    {r}
                  </span>
                ))}
              </div>
            </dd>
            <dt>Tools you use</dt>
            <dd>
              <div className="chips">
                {business.tools.map((t) => (
                  <span className="chip" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </dd>
            <dt>What eats your week</dt>
            <dd>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {/* Claude writes these, so two can match; the list never reorders, so the index is a stable key */}
                {business.tasks.map((task, index) => (
                  <li key={index}>{task}</li>
                ))}
              </ul>
            </dd>
            <dt>How you sound</dt>
            <dd>
              <span className="draft">{business.voice}</span>
            </dd>
            <dt>Rules every agent follows</dt>
            <dd>
              No texts from 8 p.m. to 8 a.m. No text without a consent record. No answers to allergy questions. No
              prices or offers outside the ones you allow.
            </dd>
          </dl>
        </div>
        <div className="stack-y">
          <div className="panel">
            <h3>Your workflows</h3>
            <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
              The 5 shared workflows, plus {added.length} your answers added.
            </p>
            <div className="chips" style={{ marginTop: 10 }}>
              {BASE_WORKFLOWS.map((wf) => (
                <span className="chip" key={wf}>
                  {WORKFLOWS[wf].name}
                </span>
              ))}
            </div>
            {added.length > 0 && (
              <div className="chips" style={{ marginTop: 8 }}>
                {added.map((w) => (
                  <span className="chip new" key={w.id}>
                    {WORKFLOWS[w.id].name}
                  </span>
                ))}
              </div>
            )}
            {fresh.length > 0 && (
              <p className="small" style={{ marginTop: 12 }}>
                <b>New for you:</b> {fresh.join(", ")}. You don&apos;t do {fresh.length === 1 ? "this" : "these"} today.
              </p>
            )}
          </div>
          {business.nicheAgents.length > 0 && (
            <div className="panel">
              <h3>Spawned for you</h3>
              <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
                Work only some businesses have gets its own agent. It uses the same actions and rules as the five core
                agents, and asks before every card.
              </p>
              <ul className="stack-y" style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                {business.nicheAgents.map((agent) => (
                  <li key={agent.id}>
                    <b>{agent.name} agent</b>
                    <p className="small" style={{ color: "var(--ink-2)" }}>
                      {asSentence(agent.job)}
                    </p>
                    <p className="small muted">Why it&apos;s here: {asSentence(agent.spawnedBecause)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="notice">{authorship(business)}</div>
        </div>
      </div>
    </>
  );
}
