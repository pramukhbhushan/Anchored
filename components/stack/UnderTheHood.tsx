import { ChevronRight } from "lucide-react";
import { asSentence } from "@/components/agent-labels";
import styles from "@/components/stack/stack.module.css";
import { Badge } from "@/components/ui/Badge";
import { fitLine } from "@/components/view-helpers";
import { MODEL_TIERS, rulesFor, SKILLS } from "@/lib/domain/agents";
import { toolName } from "@/lib/domain/catalog";
import type { ChosenTool } from "@/lib/domain/paths";
import { CHECKS, rateTool, usesSoftware } from "@/lib/domain/rating";
import type { ActiveAgent, BusinessProfile, Tool } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's closed "Under the hood" disclosure, for judges and the
// curious: what Anchored knows and reads, each agent's skills with what they
// read, may do and never do, the Claude model behind each, and how each
// chosen tool scored. A native `details`, so it needs no client code.

const VOICE_PREVIEW = 60;

/** Render the disclosure with the profile, data sources, agent skills and tool checks. */
export function UnderTheHood({
  business,
  agents,
  tools,
}: {
  readonly business: BusinessProfile;
  readonly agents: readonly ActiveAgent[];
  readonly tools: readonly ChosenTool[];
}) {
  const reads = [
    ...new Set([
      ...agents.flatMap((a) => a.skills.flatMap((s) => SKILLS[s].reads)),
      ...tools.flatMap((x) => (x.path === "turnon" && x.tool.platform ? [`Your ${x.tool.platform} account`] : [])),
    ]),
  ];
  const voice = business.voice.length > VOICE_PREVIEW ? `${business.voice.slice(0, VOICE_PREVIEW)}...` : business.voice;

  return (
    <details className={styles.hood}>
      <summary className={styles.hoodSummary}>
        <ChevronRight className={styles.chev} aria-hidden="true" size={20} />
        <span>
          <span className={styles.hoodTitle}>Under the hood</span>
          <span className={styles.hoodSub}>Skills, Claude models, setup steps and tool scores for each piece</span>
        </span>
      </summary>
      <div className={styles.hoodBody}>
        <div className={styles.hoodGrid}>
          <article className={styles.hoodPanel}>
            <h3>What Anchored knows</h3>
            <dl className={styles.facts}>
              <dt>Business</dt>
              <dd>
                {business.trade}, {business.size}
              </dd>
              <dt>Languages</dt>
              <dd>{business.languages.join(" and ")}</dd>
              <dt>Voice</dt>
              <dd>&quot;{voice}&quot;</dd>
              <dt>Rules</dt>
              <dd>
                <ul>
                  {rulesFor(business).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </dd>
            </dl>
          </article>
          <article className={styles.hoodPanel}>
            <h3>What it reads</h3>
            {reads.length > 0 ? (
              <ul className={styles.hoodList}>
                {reads.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.hoodJob}>Nothing connected yet.</p>
            )}
          </article>
        </div>
        <div className={styles.hoodGrid}>
          {agents.map((agent) => (
            <AgentPanel key={agent.id} business={business} agent={agent} />
          ))}
          {tools.map(({ tool, path }) => (
            <ToolPanel key={tool.id} business={business} tool={tool} path={path} />
          ))}
        </div>
      </div>
    </details>
  );
}

// -----------------------------------------------------------------
// Panels
// -----------------------------------------------------------------

/** Render one agent with each skill it runs here: reads, does, never, model and setup. */
function AgentPanel({ business, agent }: { readonly business: BusinessProfile; readonly agent: ActiveAgent }) {
  const reason = spawnReason(business, agent);
  return (
    <article className={styles.hoodPanel}>
      <h3>{agent.name} agent</h3>
      <p className={styles.hoodJob}>{agent.job}</p>
      {reason !== null && (
        <p className={styles.hoodWhy}>
          <Badge tone="new">Niche agent, spawned for you</Badge> {reason} It asks before every card.
        </p>
      )}
      {agent.skills.map((skillId) => {
        const skill = SKILLS[skillId];
        const tier = MODEL_TIERS[skill.tier];
        return (
          <section key={skillId} className={styles.hoodSkill}>
            <h4>{skill.name} skill</h4>
            <p className={styles.hoodJob}>{skill.job}</p>
            <dl className={styles.facts}>
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
                {tier.model}, {skill.tier} tier. <span className="muted">{tier.why} Anchored picks it for you.</span>
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
}

/** Render one chosen tool with its fit score, the checks an owner cares about, setup and source. */
function ToolPanel({
  business,
  tool,
  path,
}: {
  readonly business: BusinessProfile;
  readonly tool: Tool;
  readonly path: "turnon" | "buy";
}) {
  const rating = rateTool(tool, business);
  return (
    <article className={styles.hoodPanel}>
      <h3>{toolName(tool)}</h3>
      <p className={styles.hoodJob}>
        {path === "turnon" ? `Part of ${tool.platform ?? tool.maker}, which you already use` : tool.price}
      </p>
      <dl className={styles.facts}>
        <dt>Fit</dt>
        <dd>
          {rating.total}/100. {fitLine(rating, CHECKS.length)}
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
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

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
