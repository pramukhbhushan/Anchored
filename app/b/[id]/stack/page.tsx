import type { Metadata } from "next";
import Link from "next/link";
import { asSentence, skillList } from "@/components/agent-labels";
import { businessHref } from "@/components/routes";
import { Stamp } from "@/components/Stamp";
import { monthlyCost, money, plannedWorkflows } from "@/components/view-helpers";
import { MODEL_TIERS, SKILLS } from "@/lib/domain/agents";
import { morningBrief } from "@/lib/domain/brief";
import { toolById, toolName } from "@/lib/domain/catalog";
import { activeAgents, chosenTools, pathOptions, stackCost } from "@/lib/domain/paths";
import { rateTool, usesSoftware } from "@/lib/domain/rating";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { ActiveAgent, BusinessProfile, Choice, Tool, WorkflowId } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Step 4, the stack: what runs each workflow and what it costs a month, the
// five layers, then one under-the-hood card per active agent (each skill with
// what it reads, does, never does, its model and setup) and per chosen tool.

export const metadata: Metadata = { title: "Your stack" };

const VOICE_PREVIEW = 60;

/** Return what runs one workflow and its monthly price, as the cost table shows them. */
function stackRow(business: BusinessProfile, workflow: WorkflowId, choice: Choice): { item: string; price: string } {
  if (choice.path === "build") {
    const agent = pathOptions(business, workflow).build?.agentName;
    const skills = skillList(choice.skills);
    return { item: agent === undefined ? skills : `${agent} agent, ${skills}`, price: "Included" };
  }
  if (choice.path === "skip") return { item: "", price: "" };
  const tool = toolById(choice.toolId);
  if (tool === undefined) return { item: "", price: "" };
  if (choice.path === "turnon") return { item: toolName(tool), price: "Already paid" };
  const cost = monthlyCost(tool, business);
  return { item: toolName(tool), price: cost === null ? "On quote" : money(cost) };
}

/** Return the why-it's-here sentence for a niche agent, or `null` for a core agent. */
function spawnReason(business: BusinessProfile, agent: ActiveAgent): string | null {
  if (!agent.niche) return null;
  const niche = business.nicheAgents.find((n) => n.id === agent.id);
  return niche === undefined ? null : asSentence(niche.spawnedBecause);
}

/** Return the three setup steps for a chosen tool, which differ for turning on versus buying. */
function toolSetup(business: BusinessProfile, tool: Tool, path: "turnon" | "buy"): string[] {
  if (path === "turnon") {
    return [
      `Open your ${tool.platform ?? tool.maker} account`,
      `Turn on ${tool.name} in its settings or app store`,
      "Run it for a week, then check what it did",
    ];
  }
  const connectTo = tool.connects?.find((name) => usesSoftware(business, name)) ?? "your tools";
  return [
    "Start on the vendor's page (source below)",
    `Connect it to ${connectTo} if it's listed`,
    "Run it for a week, then check what it did",
  ];
}

/** Render the cost table, five layers, under-the-hood cards and SBDC links for the business in the URL. */
export default async function StackPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, feed] = await Promise.all([getChoices(business), getFeed(business)]);
  const planned = plannedWorkflows(business);
  const cost = stackCost(business, choices);
  const agents = activeAgents(business, choices);
  // A tool chosen for two workflows gets one card; the later choice's path wins, as in the prototype.
  const tools = [...new Map(chosenTools(business, choices).map((x) => [x.tool.id, x])).values()];
  const dataIn = [
    ...new Set([
      ...agents.flatMap((a) => a.skills.flatMap((s) => SKILLS[s].reads)),
      ...tools.flatMap((x) => (x.path === "turnon" && x.tool.platform ? [`Your ${x.tool.platform} account`] : [])),
    ]),
  ];
  const actedOn = feed.cards.filter((c) => c.status === "approved").reduce((sum, c) => sum + (c.stake ?? 0), 0);
  const fresh = planned.filter((w) => w.plan.isNew).map((w) => WORKFLOWS[w.id].name);
  const brief = morningBrief(business, choices, feed.cards);
  const voice =
    business.voice.length > VOICE_PREVIEW ? `${business.voice.slice(0, VOICE_PREVIEW)}...` : business.voice;

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Your stack, under the hood</h2>
          <p>
            Every workflow and the path you chose, what it costs, and how the pieces work together in five layers.
            Change a path on the workflows page.
          </p>
        </div>
        <Link className="btn" href={businessHref(business.id, "agents")}>
          Watch the agents work
        </Link>
      </div>

      <div className="panel">
        <div className="scroll">
          <table className="plain stacktable">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Path</th>
                <th>What runs it</th>
                <th className="num">Per month</th>
              </tr>
            </thead>
            <tbody>
              {planned.map((w) => {
                const choice = choices[w.id];
                const row = stackRow(business, w.id, choice);
                return (
                  <tr key={w.id}>
                    <td>{WORKFLOWS[w.id].name}</td>
                    <td>
                      <Stamp path={choice.path} />
                    </td>
                    <td>{row.item || "Nothing yet"}</td>
                    <td className="num">{row.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="total">
          <span>
            Total per month
            {cost.onQuote.length > 0 && `, plus ${cost.onQuote.map((t) => t.name).join(" and ")} on quote`}
          </span>
          <b>{money(cost.total)}</b>
        </div>
        <p className="tiny muted" style={{ marginTop: 4 }}>
          {cost.plan > 0 && "Includes Anchored at a proposed $29 a month for all agents. "}
          Tools you already pay for count as $0 here. Prices come from pages checked Nov 6 and 7, 2026.
        </p>
      </div>

      <div className="grouphead">
        <h3>Five layers, one stack</h3>
        <p>How Anchored turns your answers into work done</p>
      </div>
      <div className="layers">
        <article className="layer">
          <h3>Context</h3>
          <p className="tag">Your business profile</p>
          <ul>
            <li>
              {business.trade}, {business.size}
            </li>
            <li>Works in {business.languages.join(" and ")}</li>
            <li>Your voice: &quot;{voice}&quot;</li>
            <li>Quiet hours, consent and allowed offers</li>
          </ul>
        </article>
        <article className="layer">
          <h3>Data</h3>
          <p className="tag">Connectors</p>
          <ul>
            {dataIn.length > 0 ? (
              dataIn.slice(0, 6).map((source) => <li key={source}>{source}</li>)
            ) : (
              <li>Nothing connected yet</li>
            )}
          </ul>
        </article>
        <article className="layer">
          <h3>Intelligence</h3>
          <p className="tag">Morning brief</p>
          <ul>
            {brief.slice(0, 2).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
        <article className="layer">
          <h3>Automation</h3>
          <p className="tag">Approve-first agents</p>
          <ul>
            {agents.length > 0 ? (
              agents.map((agent) => {
                const reason = spawnReason(business, agent);
                return (
                  <li key={agent.id}>
                    {agent.name} agent
                    {reason !== null && (
                      <span className="tiny" style={{ display: "block" }}>
                        Spawned for you. Why it&apos;s here: {reason} It approves every card.
                      </span>
                    )}
                  </li>
                );
              })
            ) : (
              <li>No agents chosen</li>
            )}
          </ul>
        </article>
        <article className="layer">
          <h3>Build</h3>
          <p className="tag">Money back and new ground</p>
          <ul>
            <li>{money(actedOn)} acted on so far</li>
            {fresh.length > 0 && <li>New for you: {fresh.join(", ")}</li>}
            <li>Hours saved aren&apos;t claimed. A count of taps can&apos;t prove them.</li>
          </ul>
        </article>
      </div>

      <div className="grouphead">
        <h3>Under the hood, piece by piece</h3>
        <p>What each one reads, does and never does, and how to set it up</p>
      </div>
      <div className="hood">
        {agents.map((agent) => {
          const reason = spawnReason(business, agent);
          return (
            <article key={agent.id}>
              <h3>{agent.name} agent</h3>
              <p className="small" style={{ color: "var(--ink-2)", marginTop: 4 }}>
                {agent.job}
              </p>
              {reason !== null && (
                <p className="small" style={{ marginTop: 8 }}>
                  <span className="chip new">Spawned for you</span> Why it&apos;s here: {reason} It approves every
                  card.
                </p>
              )}
              {agent.skills.map((skillId) => {
                const skill = SKILLS[skillId];
                const tier = MODEL_TIERS[skill.tier];
                return (
                  <section key={skillId}>
                    <h4>{skill.name} skill</h4>
                    <p className="small muted">{skill.job}</p>
                    <dl>
                      <dt>Reads</dt>
                      <dd>
                        <ul>
                          {skill.reads.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </dd>
                      <dt>Can do</dt>
                      <dd>
                        <ul>
                          {skill.does.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </dd>
                      <dt>Never</dt>
                      <dd>
                        <ul>
                          {skill.never.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      </dd>
                      <dt>Model</dt>
                      <dd>
                        {tier.model}. <span className="muted">{tier.why} Anchored picks it for you.</span>
                      </dd>
                      <dt>Set up</dt>
                      <dd>
                        <ol>
                          {skill.setup.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      </dd>
                    </dl>
                  </section>
                );
              })}
            </article>
          );
        })}
        {tools.map(({ tool, path }) => {
          const rating = rateTool(tool, business);
          return (
            <article key={tool.id}>
              <h3>{toolName(tool)}</h3>
              <p className="small" style={{ color: "var(--ink-2)", marginTop: 4 }}>
                {path === "turnon" ? `Part of ${tool.platform ?? tool.maker}, which you already use` : tool.price}
              </p>
              <dl>
                <dt>Fit</dt>
                <dd>
                  {rating.total} / 100. Meets {rating.met} of 7 checks, {rating.unknown} not known yet
                </dd>
                <dt>Connects</dt>
                <dd>{rating.checks.connects[2]}</dd>
                <dt>In charge</dt>
                <dd>{rating.checks.charge[2]}</dd>
                <dt>Your data</dt>
                <dd>{rating.checks.data[2]}</dd>
                <dt>Set up</dt>
                <dd>
                  <ol>
                    {toolSetup(business, tool, path).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </dd>
                <dt>Source</dt>
                <dd>
                  {tool.source.url ? (
                    <a href={tool.source.url} target="_blank" rel="noopener">
                      Vendor page
                    </a>
                  ) : (
                    tool.source.label
                  )}
                  , checked {tool.checkedOn}
                </dd>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Want a person to help you set this up?</h3>
        <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
          Small Business Development Centers give free, one-on-one advice through the SBA. Bring this page to the
          meeting.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn sm" href="https://www.marylandsbdc.org/" target="_blank" rel="noopener">
            Maryland SBDC
          </a>
          <a className="btn sm ghost" href="https://www.sba.gov/local-assistance" target="_blank" rel="noopener">
            Find your local SBDC
          </a>
          <a className="btn sm ghost" href="https://www.score.org/find-mentor" target="_blank" rel="noopener">
            Find a SCORE mentor
          </a>
        </div>
      </div>
    </>
  );
}
