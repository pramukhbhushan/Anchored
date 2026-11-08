import Link from "next/link";
import type { CSSProperties } from "react";
import { BOAT_KIND, BOAT_SYMBOL, Boat, BoatDefs, pennant } from "@/components/site/harbor/Boats";
import { FleetChart } from "@/components/site/harbor/FleetChart";
import { HarborHero } from "@/components/site/harbor/HarborHero";
import { WatchBill } from "@/components/site/harbor/WatchBill";
import styles from "@/components/site/harbor/harbor.module.css";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { CORE_AGENTS, SKILLS } from "@/lib/domain/agents";
import type { CoreAgentId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page, in the Harbor Chart design (docs/brand.md). The hero puts
// the owner at the helm; then the gaps small businesses lose jobs in, the
// Approvals screen, the five agents as five boats, how they hand off, one
// example day where every message waits for the owner, the research behind
// it, and the anchor with Start sailing, which opens chat onboarding.

const AGENT_ORDER: readonly CoreAgentId[] = ["frontdesk", "followup", "books", "content", "internal"];

/** The line under each agent card: what that agent never does. */
const NEVER: Readonly<Record<CoreAgentId, string>> = {
  frontdesk: "Never quotes a price in a first reply. Never texts between 8 p.m. and 8 a.m.",
  followup: "Never sends without your tap.",
  books: "Never sends a reminder you haven't approved.",
  content: "Never publishes. You post what you approve.",
  internal: "Always on. Never sends anything to a customer.",
};

/** Figures from docs/research/coaching-operations.md, each with its source. */
const GAPS: readonly (readonly [figure: string, text: string, source: string])[] = [
  ["7×", "Firms that replied to a lead within an hour were nearly seven times as likely to qualify it.", "Harvard Business Review, 2011"],
  ["23%", "of firms in the same study never replied to the lead at all.", "Harvard Business Review, 2011"],
  ["75%", "of Meta lead-ad leads arrive outside weekday 9-to-5 hours.", "LeadSync, via Ainora, 2026"],
  ["93%", "of converted leads were reached by the sixth attempt.", "Velocify, via Ainora, 2026"],
];

const CASES: readonly (readonly [name: string, trade: string])[] = [
  ["College Park Heating & Air", "HVAC shop"],
  ["Linden Street Kitchen", "Restaurant"],
  ["Northpoint Career Coaching", "Career coach"],
];

/** Render the landing page. */
export default function HomePage() {
  return (
    <div className={styles.harbor}>
      <BoatDefs />
      <HarborHero>
        <p className={styles.eyebrow}>For HVAC shops, restaurants, coaches and other small businesses</p>
        <h1>Return missed calls. Chase quotes. Get paid.</h1>
        <p className={styles.helm}>
          Your crew does the work. <em>You hold the helm.</em>
        </p>
        <p className={styles.lede}>
          Five AI agents draft the texts, follow-ups and invoice reminders that slip through the cracks. You approve every one before it reaches a customer.
        </p>
        <div className={styles.row}>
          <Link className={`${styles.btn} ${styles.primary}`} href={NEW_BUSINESS_HREF}>
            Start sailing
          </Link>
          <a className={`${styles.btn} ${styles.ghost}`} href="#product">
            See the product
          </a>
        </div>
        <p className={styles.note}>One plan, $29 a month. Tools you already pay for count as $0.</p>
      </HarborHero>

      <section className={`${styles.blk} ${styles.pad}`} id="gaps" aria-labelledby="gaps-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="gaps-title">
              Small businesses lose jobs <em>in the gaps.</em>
            </h2>
            <p>Most leads aren&apos;t lost to a competitor. They&apos;re lost to a slow reply, a quote nobody chased, or a message that arrived after closing.</p>
          </div>
          <div className={styles.stats}>
            {GAPS.map(([figure, text, source]) => (
              <div key={figure}>
                <b>{figure}</b>
                <p>{text}</p>
                <cite>{source}</cite>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="product" aria-labelledby="product-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="product-title">
              Every draft lands <em>in one inbox.</em>
            </h2>
            <p>Agents draft. You approve, edit or skip. This is the Approvals page for the College Park Heating &amp; Air sample business.</p>
          </div>
          <figure className={styles.shot}>
            <div className={styles.bar}>anchored / approvals</div>
            <img src="/landing/approvals.png" alt="Approvals page: draft texts waiting for the owner, each with Approve, Edit and Skip" width={1600} height={1000} loading="lazy" />
            <figcaption>
              <b>Approve, edit or skip</b>
              <span>Each card says who drafted it, who it&apos;s for, and why now. Quiet hours and consent are checked before anything goes.</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="agents" aria-labelledby="agents-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="agents-title">
              Five agents. <em>One job each.</em>
            </h2>
            <p>Every business gets the same five agents, drawn here as the boats in your fleet. Each runs small skills, and each skill spells out what it reads, what it may do, and what it never does.</p>
          </div>
          <ul className={styles.crew}>
            {AGENT_ORDER.map((id) => {
              const agent = CORE_AGENTS[id];
              const skills = agent.skills.map((s) => SKILLS[s].name);
              return (
                <li key={id} className={styles.mate} style={{ "--pc": pennant(id) } as CSSProperties}>
                  <div className={styles.pic}>
                    <Boat symbol={BOAT_SYMBOL[id]} viewBox="0 0 200 140" />
                  </div>
                  <p className={styles.boatKind}>
                    {BOAT_KIND[id]}
                    {agent.alwaysOn ? " · always on" : ""}
                  </p>
                  <h3>{agent.name}</h3>
                  <p>{agent.job}.</p>
                  <ul className={styles.skills} aria-label={`${agent.name} skills`}>
                    {skills.slice(0, 3).map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                    {skills.length > 3 && <li>+{skills.length - 3} more</li>}
                  </ul>
                  <p className={styles.never}>{NEVER[id]}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="fleet" aria-labelledby="fleet-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="fleet-title">
              How the agents <em>work together.</em>
            </h2>
            <p>One missed call can turn into a booked job, a paid invoice and a five-star review. Each agent hands off to the next, and every draft comes back to one harbor: you.</p>
          </div>
          <FleetChart />
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="how" aria-labelledby="how-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="how-title">
              You approve <em>every message.</em>
            </h2>
            <p>Here&apos;s one example day at an HVAC shop. Agents draft from 7 a.m. to 8 p.m. Every text waits for your tap, and one approved after 8 p.m. holds until morning.</p>
          </div>
          <WatchBill />
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="proof" aria-labelledby="proof-title">
        <div className={`${styles.inner} ${styles.proof}`}>
          <div>
            <p className={styles.eyebrow}>Built on research</p>
            <h2 id="proof-title" style={{ marginTop: 12 }}>
              Researched across three very different trades.
            </h2>
            <ul className={styles.cases} style={{ marginTop: 28 }}>
              {CASES.map(([name, trade]) => (
                <li key={name}>
                  <b>{trade}</b>
                  <span>Sample business: {name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={styles.eyebrow}>Rules every agent follows</p>
            <ul className={styles.rules} style={{ marginTop: 20 }}>
              <li>
                <b>No auto-send.</b> Every card waits for your tap.
              </li>
              <li>
                <b>Quiet hours, 8 p.m. to 8 a.m.</b> Maryland bars telephone solicitations in those hours, so a text approved late waits for morning.
              </li>
              <li>
                <b>Consent first.</b> A text to a contact with no consent record doesn&apos;t send.
              </li>
              <li>
                <b>Allergy questions go to you.</b> Agents never answer them.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={`${styles.end} ${styles.pad}`} aria-labelledby="end-title">
        <div className={styles.inner}>
          <Boat symbol="boat-anchor" viewBox="0 0 120 150" className={styles.anchor} />
          <h2 id="end-title">Drop anchor on busywork.</h2>
          <p>Answer a few questions about your business. Anchored shows where AI fits, what it costs, and which agents to switch on. Skip anything you don&apos;t know.</p>
          <Link className={`${styles.btn} ${styles.primary} ${styles.endBtn}`} href={NEW_BUSINESS_HREF}>
            Start sailing
          </Link>
        </div>
      </section>
      <footer className={`${styles.foot} ${styles.pad}`}>
        <span>Built for the University of Maryland AI for Small Business Hack-a-thon, Fall 2026.</span>
        <span>The sample businesses are fictional.</span>
      </footer>
    </div>
  );
}
