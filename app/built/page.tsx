import type { Metadata } from "next";
import Link from "next/link";
import { skillList } from "@/components/agent-labels";
import { DEMO_HREF } from "@/components/routes";
import { CORE_AGENTS } from "@/lib/domain/agents";
import { TOOLS } from "@/lib/domain/catalog";

// =============================================================================
// Module Overview
// =============================================================================
// How Anchored is built: how it meets the challenge, the five layers, the five
// agents and their skills, the architecture, what's real in this build, the
// research behind it and the 16-week roadmap.

export const metadata: Metadata = { title: "How it's built" };

const LAYERS: readonly (readonly [layer: string, inAnchored: string])[] = [
  ["Context", "The business profile from onboarding: trade, customers, languages, voice and the rules every agent follows."],
  ["Data", "Connectors: forwarded calls, invoice photos, CSV uploads, forwarded email, and later Jobber, Square, Clover and QuickBooks."],
  ["Intelligence", "The morning brief: what waits for the owner today and what it's worth."],
  ["Automation", "Five approve-first agents that run skills, plus niche agents onboarding spawns. Each skill drafts a card, and plain code sends only what the owner approved."],
  ["Build", "Money back and new ground: dollars acted on, plus workflows the business has never done, such as marketing."],
];

/** Render a pipeline lane: each node with arrows between, and the `core` node in carbon yellow. */
function Lane({
  title,
  nodes,
  core,
}: {
  readonly title: string;
  readonly nodes: readonly string[];
  readonly core: string;
}) {
  return (
    <div className="lane">
      <h3>{title}</h3>
      <ol>
        {nodes.map((node) => (
          <li key={node}>
            <span className={`node${node === core ? " core" : ""}`}>{node}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Render the build notes page. */
export default function BuiltPage() {
  const agents = Object.values(CORE_AGENTS);
  return (
    <div className="wrap view">
      <div className="viewhead">
        <div>
          <h2>How Anchored is built</h2>
          <p>
            The challenge asks for a platform that helps small businesses discover, compare and adopt AI tools.
            Workflows are the what. Five layers are the how. Each workflow has three paths. On the build path, five
            agents run skills, and onboarding can spawn a niche agent for work only some businesses have, such as a SNAP
            stocking check.
          </p>
        </div>
        <Link className="btn" href={DEMO_HREF}>
          Open the prototype
        </Link>
      </div>
      <div className="cols3">
        <div className="panel">
          <h3>Discovery</h3>
          <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
            A discovery agent searches for tools for each workflow and records price, integrations, data terms, contract,
            source link and date checked. New listings wait in a review queue until a person checks them. The catalog
            starts with {TOOLS.length} tools from our research.
          </p>
        </div>
        <div className="panel">
          <h3>Rating beyond reviews</h3>
          <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
            Seven checks: price and cancel terms, easy to start, connects to your software, states data use, you stay in
            charge, names your languages, proven in similar businesses. Onboarding personalizes them, so a Clover shop
            and a Square shop see different scores. Every check shows its evidence level.
          </p>
        </div>
        <div className="panel">
          <h3>Many tools at once</h3>
          <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
            The stack view lists every workflow and its chosen path, with the total monthly cost and an under-the-hood
            panel for each tool and agent.
          </p>
        </div>
        <div className="panel">
          <h3>How to engage</h3>
          <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>
            Each tool and agent comes with setup steps, and every stack links to free help from the local Small Business
            Development Center, an SBA program.
          </p>
        </div>
      </div>

      <section className="band" style={{ marginTop: 36 }}>
        <h2>Five layers</h2>
        <div className="scroll" style={{ marginTop: 14 }}>
          <table className="plain">
            <thead>
              <tr>
                <th>Layer</th>
                <th>In Anchored</th>
              </tr>
            </thead>
            <tbody>
              {LAYERS.map(([layer, text]) => (
                <tr key={layer}>
                  <td>
                    <b>{layer}</b>
                  </td>
                  <td>{text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <h2>Five agents that run skills</h2>
        <p className="prose" style={{ marginTop: 8 }}>
          Every business gets the same five agents. Choosing Build on a workflow hands it to one of them as a skill, so
          quote follow-up is the Follow-up agent&apos;s Closer skill. Work only some businesses have, such as a SNAP
          stocking check, gets a niche agent that onboarding spawns. It reuses the same actions and rules, and it asks
          before every card.
        </p>
        <div className="scroll" style={{ marginTop: 14 }}>
          <table className="plain">
            <thead>
              <tr>
                <th>Agent</th>
                <th>What it does</th>
                <th>Skills</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <b>{agent.name}</b>
                  </td>
                  <td>{agent.job}</td>
                  <td>{skillList(agent.skills)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <h2>Architecture</h2>
        <p className="prose" style={{ marginTop: 8 }}>
          One Next.js app on Vercel, Supabase Postgres for every business&apos;s data, and the Claude API for reading
          and drafting. A new kind of business needs no new code, and a new tool is one row of data.
        </p>
        <div className="lanes">
          <Lane
            title="Every event, such as a missed call or a new invoice"
            nodes={[
              "Owner's phone",
              "Next.js on Vercel",
              "Supabase Postgres, row-level security per business",
              "Agent worker with Claude: Haiku, Sonnet or Opus by task",
              "Card",
              "Owner approves",
              "Executor in code checks rules, then sends",
            ]}
            core="Owner approves"
          />
          <Lane
            title="Every week, for the catalog"
            nodes={[
              "Discovery agent searches per workflow",
              "Review queue",
              "A person checks price, contract and data terms",
              "Catalog with evidence levels",
              "Seven checks, scored in code per business",
            ]}
            core="Seven checks, scored in code per business"
          />
        </div>
        <div className="scroll" style={{ marginTop: 16 }}>
          <table className="plain">
            <thead>
              <tr>
                <th>Choice</th>
                <th>Why it scales</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Signals, not trade templates</td>
                <td>
                  Onboarding answers add workflows. A dental office, a bakery and an auto shop run through the same
                  rules. Case studies add researched numbers on top.
                </td>
              </tr>
              <tr>
                <td>Three paths per workflow</td>
                <td>
                  Anchored recommends what a business already pays for before it sells anything, and builds an agent
                  only where no tool fits.
                </td>
              </tr>
              <tr>
                <td>Scores in code</td>
                <td>
                  The model never sets a rating. Each check reads a recorded fact with its source and date, so a score
                  changes when a fact changes.
                </td>
              </tr>
              <tr>
                <td>Executor in code</td>
                <td>
                  Quiet hours, consent, allowed offers and the allergy lock are checks in code, so a tap can&apos;t
                  approve a rule break.
                </td>
              </tr>
              <tr>
                <td>Model by task</td>
                <td>
                  Short replies run on the fastest model and planning on the most capable one. The owner never has to
                  choose.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <h2>What&apos;s real in this prototype</h2>
        <div className="scroll" style={{ marginTop: 12 }}>
          <table className="plain">
            <thead>
              <tr>
                <th>Part</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Workflows for any business</td>
                <td>
                  Real. The rules run in code. With a Claude API key set, Claude also rewrites the reasons in the
                  owner&apos;s words.
                </td>
              </tr>
              <tr>
                <td>Seven-check ratings</td>
                <td>Real. Computed in code from {TOOLS.length} tools, with facts checked Nov 6 and 7, 2026.</td>
              </tr>
              <tr>
                <td>Paths, stack and cost</td>
                <td>Real, saved for your demo session.</td>
              </tr>
              <tr>
                <td>Rewrite in my voice</td>
                <td>Real when a Claude API key is set.</td>
              </tr>
              <tr>
                <td>Texts and emails</td>
                <td>
                  Simulated. A Twilio trial can&apos;t send custom messages, and carrier registration takes longer than
                  a weekend.
                </td>
              </tr>
              <tr>
                <td>Discovery agent and live connectors</td>
                <td>Designed, not built. The review queue shows real listings our research found but could not confirm.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <h2>The research behind it</h2>
        <div className="prose" style={{ marginTop: 8 }}>
          <p>
            Each team member researched one or two trades and wrote a sourced report: how the business runs, how it
            sells, what it uses, where money leaks, and what Anchored should and shouldn&apos;t do. Three became the case
            studies.
          </p>
          <p>
            Three findings shaped the product. First, the right first workflow differs by business, so Anchored maps
            from how a business works instead of assuming one fix fits all. Second, owners already pay for tools that do
            part of the job, so &quot;turn on&quot; comes before &quot;buy&quot;. Third, approval fatigue is real, so
            Anchored tracks edits, skips and dollars instead of claiming hours saved.
          </p>
        </div>
        <div className="scroll" style={{ marginTop: 14 }}>
          <table className="plain">
            <thead>
              <tr>
                <th>Case study</th>
                <th>Researched by</th>
                <th>Finding that changed the design</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>HVAC</td>
                <td>Eric</td>
                <td>
                  Replacement quotes of $7K to $15K close about 20% of the time before follow-up, so quote follow-up is a
                  top workflow.
                </td>
              </tr>
              <tr>
                <td>Restaurants</td>
                <td>Ricky Chen</td>
                <td>
                  True leads are rare, mostly catering. The money is in supplier invoices and food cost, and Square and
                  Toast already sell agents, so &quot;turn on&quot; comes first.
                </td>
              </tr>
              <tr>
                <td>Coaching</td>
                <td>Pramukh Bhushan</td>
                <td>
                  First contact happens in Instagram and LinkedIn DMs that no tool captures, so onboarding accepts
                  pasted DMs.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <h2>With 16 weeks</h2>
        <div className="roadmap" style={{ marginTop: 16 }}>
          <article>
            <h3>Weeks 1 to 4: pilot</h3>
            <ul>
              <li>10 Maryland owners through the Maryland SBDC and trade groups</li>
              <li>Time onboarding with a stopwatch</li>
              <li>Register real business texting</li>
            </ul>
          </article>
          <article>
            <h3>Weeks 5 to 8: connectors</h3>
            <ul>
              <li>Jobber, Square, Clover and QuickBooks</li>
              <li>Invoice photo accuracy on 100 real invoices</li>
              <li>Spanish and Korean screens</li>
            </ul>
          </article>
          <article>
            <h3>Weeks 9 to 12: catalog</h3>
            <ul>
              <li>200 tools with checked facts</li>
              <li>Discovery agent with the review queue</li>
              <li>&quot;Proven in similar businesses&quot; filled from pilot results</li>
            </ul>
          </article>
          <article>
            <h3>Weeks 13 to 16: proof</h3>
            <ul>
              <li>Dollars acted on per business, measured</li>
              <li>Pricing test at $29 a month</li>
              <li>Security review and audit log</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
