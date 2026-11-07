import Link from "next/link";
import type { ReactNode } from "react";
import { AgentRoster } from "@/components/site/AgentRoster";
import { ApprovalPreview } from "@/components/site/ApprovalPreview";
import { HeroMapper } from "@/components/site/HeroMapper";
import { RulesSheet } from "@/components/site/RulesSheet";
import { ToolCompare } from "@/components/site/ToolCompare";
import styles from "@/components/site/landing.module.css";
import { NEW_BUSINESS_HREF, businessHref } from "@/components/routes";
import { Stamp } from "@/components/ui/Stamp";
import { topWorkflows } from "@/components/view-helpers";
import { isAuthEnabled } from "@/lib/auth/config";
import { MODEL_TIERS, rulesFor } from "@/lib/domain/agents";
import { CASE_STUDIES, caseStudyById } from "@/lib/domain/cases";
import { TOOLS } from "@/lib/domain/catalog";
import type { BusinessProfile, PathKind } from "@/lib/domain/types";
import { PATH_DESCRIPTION, WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page. The hero maps a business live; four steps follow the
// product's own order (learn the business, check tools, hand the rest to
// agents, approve), each pairing a claim with an artifact built from the
// domain data; then the case files and the calls the research forced.

/** The three paths in the order the engine tries them, with the hero's one-line gloss. */
const PATHS: readonly (readonly [PathKind, string])[] = [
  ["turnon", `${PATH_DESCRIPTION.turnon}, switched on`],
  ["buy", `${PATH_DESCRIPTION.buy}, rated on seven checks`],
  ["build", PATH_DESCRIPTION.build],
];

/** Where the research documents disagreed, and what the code does about it. From docs/research/reconciliation.md. */
const DECIDED: readonly (readonly [found: string, does: string])[] = [
  [
    "A Twilio trial account can't send the custom texts every card drafts.",
    "Approved texts land in a demo outbox on a phone that says it's simulated. No SMS provider is connected.",
  ],
  [
    "Owners asked to approve too often end up approving almost everything, so a run of unedited approvals can measure fatigue, not quality.",
    "Every card waits for your tap. There's no auto-send mode.",
  ],
  [
    "Maryland bars telephone solicitations from 8 p.m. to 8 a.m., and its consent rules cover texts.",
    "Quiet hours run 8 p.m. to 8 a.m. A text approved late waits for the morning.",
  ],
  [
    "Promotional texts need the customer's prior written consent.",
    "A text to a contact with no consent record doesn't send.",
  ],
];

/** Return the case study with `id`, failing the render if the case data lost it. */
function requireCase(id: string): BusinessProfile {
  const business = caseStudyById(id);
  if (business === undefined) throw new Error(`The landing page needs the \`${id}\` case study.`);
  return business;
}

/** Render the landing page. */
export default function HomePage() {
  // With accounts on, `/app` sits behind sign-in, so the main call to action starts there.
  const authEnabled = isAuthEnabled();
  const startHref = authEnabled ? "/login" : NEW_BUSINESS_HREF;
  const startLabel = authEnabled ? "Get started" : "Describe your business";
  const restaurant = requireCase("restaurant");
  const hvac = requireCase("hvac");

  return (
    <>
      <section className={`wrap ${styles.hero}`} aria-labelledby="hero-title">
        <div className={styles.heroGrid}>
          <div>
            <h1 id="hero-title" className={styles.headline}>
              Find the AI that fits how your business already runs.
            </h1>
            <p className={styles.lede}>
              Tell Anchored how your business works. It finds the jobs AI can take on, turns on what your software
              already does, rates real tools for the rest, and builds approve-first agents where no tool fits.
            </p>
            <div className={`row ${styles.ctas}`}>
              <Link className="btn" href={startHref}>
                {startLabel}
              </Link>
              <a className="btn btn-secondary" href="#cases">
                See the case studies
              </a>
            </div>
            <dl className={styles.legend} aria-label="The three paths for each workflow">
              {PATHS.map(([path, text]) => (
                <div key={path}>
                  <dt>
                    <Stamp path={path} />
                  </dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroMapper />
        </div>
      </section>

      <Step
        id="learn"
        no={1}
        title="It learns your business first"
        body={
          <>
            <p>
              Answer a few questions in chat, or describe the business in one sentence. Anchored writes a one-page
              profile you confirm: how customers reach you, what you sell, the software you run and the languages you
              speak.
            </p>
            <p>
              There&apos;s no template per trade. Every business starts with the same five workflows, and each answer
              can add more. Switch case studies to watch the same rules map three different businesses.
            </p>
          </>
        }
      >
        <RulesSheet />
      </Step>

      <Step
        id="tools"
        no={2}
        title="It checks what you already pay for, then rates what you'd buy"
        body={
          <>
            <p>
              For each workflow, Anchored looks first for a feature inside software you already run, so you switch
              something on instead of buying another app.
            </p>
            <p>
              Where you&apos;d need a new tool, it rates the catalog for your business on seven checks, from whether a
              tool connects to your software to whether you stay in charge of what it says.
            </p>
          </>
        }
        note={`${TOOLS.length} tools rated from vendor pages read Nov 6 and 7, 2026. A discovery agent keeps finding new listings, and a person checks each one before it gets a score.`}
      >
        <ToolCompare business={restaurant} workflow="calls" />
      </Step>

      <Step
        id="agents"
        no={3}
        title="Five agents cover the work no tool fits"
        body={
          <>
            <p>
              Every business gets the same five agents. Each runs small skills, such as Callback or Closer, and each
              skill spells out what it reads, what it may do and what it never does.
            </p>
            <p>
              When onboarding turns up work only some businesses have, Anchored spawns a niche agent for that business
              alone.
            </p>
          </>
        }
        note={`Claude writes the drafts: ${MODEL_TIERS.quick.model} for routine texts, ${MODEL_TIERS.default.model} for writing in your voice. Code picks the workflows, computes every score and checks every send.`}
      >
        <AgentRoster />
      </Step>

      <Step
        id="approve"
        no={4}
        title="Nothing reaches a customer until you tap Approve"
        body={
          <>
            <p>Agents draft cards. You approve, edit or skip each one, and code checks every text before it can go:</p>
            <ul className={styles.ticks}>
              {rulesFor(hvac).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </>
        }
        note="Each morning a brief lists the cards waiting for you and the dollars riding on them."
      >
        <ApprovalPreview business={hvac} skill="closer" />
      </Step>

      <section className={styles.research} id="cases" aria-labelledby="cases-title">
        <div className="wrap">
          <div className={styles.researchHead}>
            <h2 id="cases-title" className={styles.title}>
              Researched with three very different businesses
            </h2>
            <p className={styles.body}>
              We studied an HVAC shop, a restaurant and a career coach, with sourced reports on how each one runs and
              where it loses money. The same rules map all three, and the research adds the numbers behind each pick.
            </p>
          </div>
          <div className={styles.files}>
            {CASE_STUDIES.map((business) => (
              <CaseFile key={business.id} business={business} />
            ))}
          </div>

          <div className={styles.decided}>
            <h3>Where our research disagreed, and what we decided</h3>
            <p>
              We wrote the reports in parallel, so they conflicted in places. Each conflict got a written call, and the
              code follows it.
            </p>
            <table className="rtable">
              <thead>
                <tr>
                  <th scope="col">What the research found</th>
                  <th scope="col">What Anchored does</th>
                </tr>
              </thead>
              <tbody>
                {DECIDED.map(([found, does]) => (
                  <tr key={found}>
                    <th scope="row">{found}</th>
                    <td data-label="Anchored does">{does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.close} aria-labelledby="close-title">
        <div className="wrap">
          <h2 id="close-title" className={styles.closeTitle}>
            See what Anchored would do for your business.
          </h2>
          <p className={styles.closeText}>
            Mapping a business takes one sentence and no account. The full plan opens with your workflows, the tools
            rated for you and the agents ready to draft.
          </p>
          <div className={`row ${styles.closeCtas}`}>
            <Link className={`btn ${styles.invert}`} href={startHref}>
              {startLabel}
            </Link>
            <a className={`btn ${styles.outline}`} href="#try-text">
              Map one in a sentence
            </a>
          </div>
        </div>
      </section>

      <footer className={`wrap ${styles.foot}`}>
        Built for the University of Maryland AI for Small Business Hack-a-thon, Fall 2026. Example and case-study
        businesses are fictional. Tool facts were gathered Nov 6 and 7, 2026, and can change.
      </footer>
    </>
  );
}

/** Render one step: its number tab, title and claim beside the artifact that proves it. */
function Step({
  id,
  no,
  title,
  body,
  note,
  children,
}: {
  readonly id: string;
  readonly no: number;
  readonly title: string;
  readonly body: ReactNode;
  readonly note?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.step} id={id} aria-labelledby={`${id}-title`}>
      <div className={`wrap ${styles.stepGrid}`}>
        <div className={styles.claim}>
          <span className={styles.no} aria-hidden="true">
            {no}
          </span>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          <div className={styles.body}>{body}</div>
          {note !== undefined && <p className={styles.note}>{note}</p>}
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

/** Render one case study as a file: the researched number, its source and the top three picks. */
function CaseFile({ business }: { readonly business: BusinessProfile }) {
  const research = business.caseStudy;
  return (
    <article className={styles.file}>
      <p className={styles.fileHead}>
        <b>{research?.label ?? business.trade}</b>
        <span>{business.place}</span>
      </p>
      <div className={styles.fileBody}>
        <h3 className={styles.fileName}>{business.name}</h3>
        {research !== undefined && (
          <>
            <p className={styles.fileStat}>{research.stat}</p>
            <p className={styles.fileText}>{research.statText}</p>
            <p className={styles.fileSrc}>
              {research.statSource}. Researched by {research.researchedBy}.
            </p>
          </>
        )}
      </div>
      <ul className={styles.picks} aria-label={`Top workflows for ${business.name}`}>
        {topWorkflows(business, 3).map((w) => (
          <li key={w.id}>
            <span>{WORKFLOWS[w.id].name}</span>
            <Stamp path={w.plan.rec} />
          </li>
        ))}
      </ul>
      <div className={styles.fileGo}>
        <Link className="btn btn-secondary btn-sm" href={businessHref(business.id)}>
          Open the case study
        </Link>
      </div>
    </article>
  );
}
