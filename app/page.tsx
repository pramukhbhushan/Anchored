import Link from "next/link";
import { HeroMapper } from "@/components/HeroMapper";
import { businessHref } from "@/components/routes";
import { Stamp } from "@/components/Stamp";
import { topWorkflows } from "@/components/view-helpers";
import { CASE_STUDIES } from "@/lib/domain/cases";
import { WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page: the hero with the live work order, the four steps, the
// table of answers that add workflows, and the three case-study cards under
// the `#cases` anchor.

/** What an onboarding answer adds, as the "one set of rules" table shows it. */
const ADAPT: readonly (readonly [when: string, adds: string])[] = [
  ["Every business", "The five shared workflows: answer and return calls, bookkeeping and invoicing, lead follow-up, social posts, quotes"],
  ["You buy from suppliers", "Supplier invoice and price check, from a phone photo"],
  ["You sell on delivery apps", "Delivery disputes"],
  ["Customers book appointments or tables", "No-shows and reminders"],
  ["Staff work shifts", "Staff scheduling, with a free tool before anything custom"],
  ["New customers find you on Google", "Reviews"],
  ["You take catering or events", "Catering and events"],
  ["You accept SNAP", "SNAP stocking check"],
  ["You hold licenses or permits", "License renewals"],
  ["You sell plans or memberships", "Plan renewals"],
];

/** Render the landing page. */
export default function HomePage() {
  return (
    <>
      <div className="wrap hero">
        <div className="grid">
          <div>
            <h1>AI that adapts to how your business already runs.</h1>
            <p className="lede">
              Describe any small business, from a dental office to a food truck. Anchored finds the work AI can take
              on, rates real tools against the ones you already use, and builds approve-first agents where no tool
              fits. Nothing reaches a customer until you tap Approve.
            </p>
            <div className="row ctas">
              <Link className="btn" href="/onboard">
                Describe your business
              </Link>
              <a className="btn ghost" href="#cases">
                See the case studies
              </a>
            </div>
            <p className="fine">
              No template for your trade needed. Anchored works from how customers reach you, what you sell and what
              you already use, including a cash register and paper invoices.
            </p>
          </div>
          <HeroMapper />
        </div>
      </div>

      <section className="band">
        <div className="wrap">
          <h2>Four steps from first question to first agent</h2>
          <ol className="steps4">
            <li>
              <h3>Tell us how you work</h3>
              <p>
                Answer a few questions or describe the business in a sentence. Anchored writes a one-page profile that
                you confirm.
              </p>
            </li>
            <li>
              <h3>Get your workflows</h3>
              <p>
                Five that every business shares, plus the ones your answers add, such as supplier price checks. Work
                only some businesses have, such as a SNAP stocking check, gets its own niche agent.
              </p>
            </li>
            <li>
              <h3>Pick a path for each</h3>
              <p>
                Turn on a tool you already pay for, buy one from the catalog, or hand it to one of Anchored&apos;s five
                agents, which run skills such as quote follow-up. Tools are rated on seven checks, not stars.
              </p>
            </li>
            <li>
              <h3>Run it and stay in charge</h3>
              <p>Agents draft, you approve. A morning brief says what needs you today and what it&apos;s worth.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>One set of rules for every business</h2>
          <p className="prose" style={{ marginTop: 8 }}>
            Anchored doesn&apos;t keep a template for each trade. Every business starts with the same five workflows,
            and each answer in onboarding can add more. A salon, a landscaper and an auto shop all go through the same
            rules.
          </p>
          <div className="scroll" style={{ marginTop: 16 }}>
            <table className="plain">
              <thead>
                <tr>
                  <th>When you tell us</th>
                  <th>Anchored adds</th>
                </tr>
              </thead>
              <tbody>
                {ADAPT.map(([when, adds]) => (
                  <tr key={when}>
                    <td>
                      <b>{when}</b>
                    </td>
                    <td>{adds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="band" id="cases">
        <div className="wrap">
          <h2>Three case studies</h2>
          <p className="prose" style={{ marginTop: 8 }}>
            We researched three very different businesses in depth, with sourced reports on how each one runs and where
            it loses money. The same rules map all three. The research adds the numbers behind each pick.
          </p>
          <div className="cases">
            {CASE_STUDIES.map((business) => (
              <article className="case" key={business.id}>
                <p className="who">
                  {business.caseStudy ? `${business.caseStudy.label}: ` : ""}
                  {business.name}
                </p>
                {business.caseStudy && (
                  <div>
                    <p className="stat">{business.caseStudy.stat}</p>
                    <p style={{ marginTop: 6 }}>{business.caseStudy.statText}</p>
                    <p className="src" style={{ marginTop: 4 }}>
                      {business.caseStudy.statSource}. Researched by {business.caseStudy.researchedBy}.
                    </p>
                  </div>
                )}
                <ul>
                  {topWorkflows(business, 3).map((w) => (
                    <li key={w.id}>
                      <span>{WORKFLOWS[w.id].name}</span>
                      <Stamp path={w.plan.rec} />
                    </li>
                  ))}
                </ul>
                <div className="go">
                  <Link className="btn sm ghost" href={businessHref(business.id, "workflows")}>
                    Open the case study
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          A prototype for the University of Maryland AI for Small Business Hack-a-thon, Fall 2026. Example and
          case-study businesses are fictional. Tool facts were gathered Nov 6 and 7, 2026, and can change.
        </div>
      </footer>
    </>
  );
}
