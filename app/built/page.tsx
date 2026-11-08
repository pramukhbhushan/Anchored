import type { Metadata } from "next";
import { skillList } from "@/components/agent-labels";
import { APP_HREF } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { CORE_AGENTS } from "@/lib/domain/agents";
import { TOOLS } from "@/lib/domain/catalog";

// =============================================================================
// Module Overview
// =============================================================================
// How Anchored is built: how it meets the challenge, the five layers, the five
// agents and their skills, the architecture, what runs today, the research
// behind it and the 16-week roadmap.

export const metadata: Metadata = { title: "How it's built" };

type Pair = readonly [name: string, text: string];

const CHALLENGE: readonly Pair[] = [
  [
    "Discovery",
    `A discovery agent, designed but not built yet, will search for tools for each workflow and record price, integrations, data terms, contract, source link and date checked. New listings wait in a review queue until a person checks them. The catalog starts with ${TOOLS.length} tools from our research.`,
  ],
  [
    "Rating beyond reviews",
    "Seven checks: price and cancel terms, easy to start, connects to your software, states data use, you stay in charge, names your languages, proven in similar businesses. Onboarding personalizes them, so a Clover shop and a Square shop see different scores. Every check shows its evidence level.",
  ],
  [
    "Many tools at once",
    "The stack view lists every workflow and its chosen path, with the total monthly cost and a card for each tool and agent.",
  ],
  [
    "How to engage",
    "Each tool and agent comes with setup steps, and every stack links to free help from the local Small Business Development Center, an SBA program.",
  ],
];

const LAYERS: readonly Pair[] = [
  [
    "Context",
    "The business profile from onboarding: trade, customers, languages, voice and the rules every agent follows.",
  ],
  [
    "Data",
    "Connectors: forwarded calls, invoice photos, CSV uploads, forwarded email, and later Jobber, Square, Clover and QuickBooks.",
  ],
  ["Intelligence", "The morning brief: what waits for the owner today and what it's worth."],
  [
    "Automation",
    "Five approve-first agents that run skills, plus niche agents onboarding spawns. Each skill drafts a card, and plain code sends only what the owner approved.",
  ],
  [
    "Build",
    "Money back and new ground: dollars acted on, plus workflows the business has never done, such as marketing.",
  ],
];

const CHOICES: readonly Pair[] = [
  [
    "Signals, not trade templates",
    "Onboarding answers add workflows. A dental office, a bakery and an auto shop run through the same rules. The example business adds researched numbers on top.",
  ],
  [
    "Three paths per workflow",
    "Anchored recommends what a business already pays for before it sells anything, and builds an agent only where no tool fits.",
  ],
  [
    "Scores in code",
    "The model never sets a rating. Each check reads a recorded fact with its source and date, so a score changes when a fact changes.",
  ],
  [
    "Executor in code",
    "Quiet hours, consent, allowed offers and the allergy lock are checks in code, so a tap can't approve a rule break.",
  ],
  [
    "Model by task",
    "Short replies run on the fastest model and planning on the most capable one. The owner never has to choose.",
  ],
];

const STATUS: readonly Pair[] = [
  [
    "Workflows for any business",
    "Live. The rules run in code. With an AI provider set, it also rewrites the reasons in the owner's words.",
  ],
  ["Chat onboarding", "Live. Rules ask the questions; with an AI provider set, the model reads free answers too."],
  ["Seven-check ratings", `Live. Computed in code from ${TOOLS.length} tools, with facts checked Nov 6 and 7, 2026.`],
  ["Paths, stack and cost", "Live, saved to your account."],
  ["Rewrite in my voice", "Live when an AI provider is set."],
  [
    "Texts and emails",
    "Not connected yet. Business texting needs carrier registration, so approved messages wait in the outbox until you connect texting and email.",
  ],
  [
    "Discovery agent and live connectors",
    "Designed, not built yet. The review queue shows real listings our research found but could not confirm.",
  ],
];

const RESEARCH: readonly (readonly [study: string, by: string, finding: string])[] = [
  [
    "HVAC",
    "Eric",
    "Replacement quotes of $7K to $15K close about 20% of the time before follow-up, so quote follow-up is a top workflow.",
  ],
  [
    "Restaurants",
    "Ricky Chen",
    'True leads are rare, mostly catering. The money is in supplier invoices and food cost, and Square and Toast already sell agents, so "turn on" comes first.',
  ],
  [
    "Coaching",
    "Pramukh Bhushan",
    "68% of coaching clients think it over for weeks after a discovery call, so the Follow-up agent drafts the check-ins after 'let me think about it'.",
  ],
];

const ROADMAP: readonly (readonly [title: string, items: readonly string[]])[] = [
  [
    "Weeks 1 to 4: pilot",
    [
      "10 Maryland owners through the Maryland SBDC and trade groups",
      "Time onboarding with a stopwatch",
      "Register real business texting",
    ],
  ],
  [
    "Weeks 5 to 8: connectors",
    [
      "Jobber, Square, Clover and QuickBooks",
      "Invoice photo accuracy on 100 real invoices",
      "Spanish and Korean screens",
    ],
  ],
  [
    "Weeks 9 to 12: catalog",
    [
      "200 tools with checked facts",
      "Discovery agent with the review queue",
      '"Proven in similar businesses" filled from pilot results',
    ],
  ],
  [
    "Weeks 13 to 16: proof",
    ["Dollars acted on per business, measured", "Pricing test at $29 a month", "Security review and audit log"],
  ],
];

/** Render a two-column table whose rows are `pairs`, stacking into labelled blocks at phone width. */
function PairTable({ head, pairs }: { readonly head: readonly [string, string]; readonly pairs: readonly Pair[] }) {
  return (
    <table className="rtable">
      <thead>
        <tr>
          <th scope="col">{head[0]}</th>
          <th scope="col">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map(([name, text]) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            <td data-label={head[1]}>{text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
    <div className="wrap doc">
      <PageHeader
        title="How Anchored is built"
        description="The challenge asks for a platform that helps small businesses discover, compare and adopt AI tools. Workflows are the what. Five layers are the how. Each workflow has three paths, and on the build path five agents run skills."
        actions={<ButtonLink href={APP_HREF}>Open app</ButtonLink>}
      />

      <dl className="doc-defs">
        {CHALLENGE.map(([title, text]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>

      <section className="section" aria-labelledby="layers">
        <SectionHeader id="layers" title="Five layers" />
        <PairTable head={["Layer", "In Anchored"]} pairs={LAYERS} />
      </section>

      <section className="section" aria-labelledby="agents">
        <SectionHeader
          id="agents"
          title="Five agents that run skills"
          description="Choosing Build on a workflow hands it to one agent as a skill, so quote follow-up is the Follow-up agent's Closer skill. Work only some businesses have, such as a SNAP stocking check, gets a niche agent that onboarding spawns. It reuses the same actions and rules, and it asks before every card."
        />
        <table className="rtable">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">What it does</th>
              <th scope="col">Skills</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <th scope="row">{agent.name}</th>
                <td data-label="What it does">{agent.job}</td>
                <td data-label="Skills">{skillList(agent.skills)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section" aria-labelledby="architecture">
        <SectionHeader
          id="architecture"
          title="Architecture"
          description="One Next.js app on Vercel, Supabase Postgres for every business's data and sign-in, and a provider-agnostic model layer for reading and drafting. A new kind of business needs no new code, and a new tool is one row of data."
        />
        <div className="lanes">
          <Lane
            title="Every event, such as a missed call or a new invoice"
            nodes={[
              "Owner's phone",
              "Next.js on Vercel",
              "Supabase Postgres, row-level security per account",
              "Agent worker: fast, default or most capable model by task",
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
        <PairTable head={["Choice", "Why it scales"]} pairs={CHOICES} />
      </section>

      <section className="section" aria-labelledby="today">
        <SectionHeader id="today" title="What runs today" />
        <PairTable head={["Part", "Status"]} pairs={STATUS} />
      </section>

      <section className="section" aria-labelledby="research">
        <SectionHeader
          id="research"
          title="The research behind it"
          description="Each team member researched one or two trades and wrote a sourced report: how the business runs, how it sells, what it uses, where money leaks, and what Anchored should and shouldn't do. The restaurant report became the example business, and the HVAC shop and the career coach open the landing page's mapper."
        />
        <p className="prose">
          Three findings shaped the product. First, the right first workflow differs by business, so Anchored maps
          from how a business works instead of assuming one fix fits all. Second, owners already pay for tools that do
          part of the job, so &quot;turn on&quot; comes before &quot;buy&quot;. Third, approval fatigue is real, so
          Anchored tracks edits, skips and dollars instead of claiming hours saved.
        </p>
        <table className="rtable">
          <thead>
            <tr>
              <th scope="col">Trade</th>
              <th scope="col">Researched by</th>
              <th scope="col">Finding that changed the design</th>
            </tr>
          </thead>
          <tbody>
            {RESEARCH.map(([study, by, finding]) => (
              <tr key={study}>
                <th scope="row">{study}</th>
                <td data-label="Researched by">{by}</td>
                <td data-label="Finding">{finding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section" aria-labelledby="roadmap">
        <SectionHeader id="roadmap" title="With 16 weeks" />
        <ol className="roadmap">
          {ROADMAP.map(([title, items]) => (
            <li key={title}>
              <h3>{title}</h3>
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
