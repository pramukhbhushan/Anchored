import Link from "next/link";
import type { CSSProperties } from "react";
import { BOAT_SYMBOL, Boat, BoatDefs, pennant } from "@/components/site/harbor/Boats";
import { FleetChart } from "@/components/site/harbor/FleetChart";
import { HarborHero } from "@/components/site/harbor/HarborHero";
import { WatchBill } from "@/components/site/harbor/WatchBill";
import styles from "@/components/site/harbor/harbor.module.css";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { CORE_AGENTS } from "@/lib/domain/agents";
import type { CoreAgentId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page, in the Harbor Chart design (docs/brand.md), written for
// an owner deciding whether Anchored is worth $29 a month. The hero leads with
// the outcome; then the gaps jobs are lost in, three setup steps, the
// Approvals screen, the five jobs Anchored covers, how one customer moves from
// missed call to paid invoice, one example day, the keep, buy or skip plan,
// the trades it fits, the rules that keep the owner in charge, the price, the
// common questions, and the anchor with the setup button.

const AGENT_ORDER: readonly CoreAgentId[] = ["frontdesk", "followup", "books", "content", "internal"];

/** What each agent card promises, in the owner's words: the outcome, the work it covers, and what it never does. */
const COVERS: Readonly<Record<CoreAgentId, { readonly outcome: string; readonly does: string; readonly tasks: readonly string[]; readonly never: string }>> = {
  frontdesk: {
    outcome: "Answer every new customer",
    does: "Drafts a reply the moment a call is missed or a new inquiry, booking or catering request comes in.",
    tasks: ["Missed calls", "New inquiries", "Appointment reminders", "Catering requests"],
    never: "Never quotes a price in a first reply. Never texts between 8 p.m. and 8 a.m.",
  },
  followup: {
    outcome: "Win the quotes you already sent",
    does: "Checks in on quotes that went quiet and undecided leads, renews plans, and asks happy customers for reviews.",
    tasks: ["Quiet quotes", "Undecided leads", "Plan renewals", "Reviews and referrals"],
    never: "Never sends without your tap.",
  },
  books: {
    outcome: "Get paid on time",
    does: "Drafts polite reminders for late invoices and flags supplier prices that crept up since your last order.",
    tasks: ["Late invoices", "Supplier prices"],
    never: "Never sends a reminder you haven't approved.",
  },
  content: {
    outcome: "Keep your reviews and posts fresh",
    does: "Drafts social posts, Google listing updates and replies to reviews, ready for you to publish.",
    tasks: ["Social posts", "Google listing", "Review replies"],
    never: "Never publishes. You post what you approve.",
  },
  internal: {
    outcome: "Start each day knowing what matters",
    does: "Sends a morning summary of what needs you and what it's worth, sorts forwarded email, and tracks license renewals.",
    tasks: ["Morning summary", "Forwarded email", "License renewals"],
    never: "Always on. Never sends anything to a customer.",
  },
};

/** Figures from docs/research/coaching-operations.md, each with its source. */
const GAPS: readonly (readonly [figure: string, text: string, source: string])[] = [
  ["7×", "Firms that replied to a lead within an hour were nearly seven times as likely to qualify it.", "Harvard Business Review, 2011"],
  ["23%", "of firms in the same study never replied to the lead at all.", "Harvard Business Review, 2011"],
  ["75%", "of Meta lead-ad leads arrive outside weekday 9-to-5 hours.", "LeadSync, via Ainora, 2026"],
  ["93%", "of converted leads were reached by the sixth attempt.", "Velocify, via Ainora, 2026"],
];

const STEPS: readonly (readonly [title: string, text: string])[] = [
  ["Tell us how you work", "Your trade, the tools you use, and where customers slip away. Answer in your own words and skip anything you don't know."],
  ["See your plan and the price", "Anchored shows which jobs your current tools already cover, which new tools are worth buying, and what it all costs each month."],
  ["Approve the work each day", "Texts, follow-ups and reminders arrive written and ready. Read them, edit if you like, and tap send."],
];

/** The four answers the plan gives for each job, in the order Anchored tries them. */
const PATHS: readonly { readonly label: string; readonly title: string; readonly text: string; readonly cost: string }[] = [
  { label: "Turn on", title: "Switch on what you have", text: "If your booking system already sends reminders, Anchored shows you where to turn that on.", cost: "Adds $0" },
  { label: "Buy", title: "Buy only what pays off", text: "When a proven tool does the job well, you see it rated side by side with its real price.", cost: "Priced up front" },
  { label: "Anchored drafts it", title: "Fill the gaps", text: "Where no tool fits, an Anchored helper writes the work and you approve it.", cost: "Included in $29" },
  { label: "Skip", title: "Skip the rest", text: "Some jobs aren't worth paying to automate. Anchored tells you which ones.", cost: "Adds $0" },
];

/** What Anchored does in each researched trade, from docs/research. */
const TRADES: readonly { readonly trade: string; readonly jobs: readonly string[]; readonly sample?: string }[] = [
  {
    trade: "HVAC and home services",
    jobs: ["Text back the evening no-heat call before they dial the next company", "Check in on the $1,200 quote that went quiet", "Renew maintenance plans before they lapse"],
    sample: "College Park Heating & Air",
  },
  {
    trade: "Restaurants",
    jobs: ["Answer catering requests the same day", "Reply to reviews in your own voice", "Catch supplier prices that crept up"],
    sample: "Linden Street Kitchen",
  },
  {
    trade: "Coaches",
    jobs: ["Follow up after \"let me think about it\"", "Cut no-shows with reminders", "Ask finishing clients for referrals"],
    sample: "Northpoint Career Coaching",
  },
  {
    trade: "Corner stores",
    jobs: ["Check supplier invoices against the last price you paid", "Keep every license renewal on one calendar", "Start each day with one short summary"],
  },
];

const INCLUDED: readonly string[] = [
  "A plan for your business: which tools to keep, buy or skip",
  "All five helpers, each drafting for your OK",
  "Texts, email and invoice reminders through your own accounts",
  "Quiet hours and consent checks on every message",
  "A morning summary of what needs you",
];

const FAQ: readonly (readonly [question: string, answer: string])[] = [
  ["Will Anchored text my customers without asking me?", "No. Every text, email and post waits for your tap. If you approve a text after 8 p.m., it waits until 8 a.m."],
  ["Do I have to give up the tools I use now?", "No. Anchored starts from the tools you already pay for and shows which ones can do more. It drafts work itself only where nothing you have fits."],
  ["I'm not a tech person. Can I set this up?", "Setup is a conversation. Describe your business in your own words, skip any question you can't answer, and change your answers later."],
  ["What kinds of businesses is it for?", "Owner-run shops with a small team: HVAC and other trades, restaurants, corner stores, coaches and similar. If customers call, text or email you, it fits."],
  ["What does it cost?", "$29 a month for Anchored. Your plan lists it next to every tool you keep or buy, so you see the full monthly total before you switch anything on."],
  ["What happens to my customer list?", "Anchored uses it only to draft your messages. Texts go only to customers with consent on file, and you can delete your businesses and their data at any time."],
];

/** Render the landing page. */
export default function HomePage() {
  return (
    <div className={styles.harbor}>
      <BoatDefs />
      <HarborHero>
        <p className={styles.eyebrow}>For HVAC shops, restaurants, coaches and other small businesses</p>
        <h1>AI that fits how your business runs.</h1>
        <p className={styles.helm}>Tell us how you work. We&apos;ll show you where AI saves time.</p>
        <p className={styles.lede}>
          Anchored starts with the tools you already pay for. Where they fall short, it writes the texts and reminders for you, and you approve each one.
        </p>
        <div className={styles.row}>
          <Link className={`${styles.btn} ${styles.primary}`} href={NEW_BUSINESS_HREF}>
            Set up my business
          </Link>
          <a className={`${styles.btn} ${styles.ghost}`} href="#how-it-works">
            See how it works
          </a>
        </div>
        <p className={styles.note}>One plan, $29 a month. No credit card to set up.</p>
      </HarborHero>

      <section className={`${styles.blk} ${styles.pad}`} id="gaps" aria-labelledby="gaps-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="gaps-title">
              Small businesses lose jobs <em>in the gaps.</em>
            </h2>
            <p>Most jobs aren&apos;t lost to a better competitor. They&apos;re lost to a slow reply, a quote nobody chased, or a message that came in after closing.</p>
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

      <section className={`${styles.blk} ${styles.pad}`} id="how-it-works" aria-labelledby="steps-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="steps-title">
              Set up in <em>one conversation.</em>
            </h2>
            <p>No forms and no sales call. Tell Anchored about your business the way you&apos;d brief a new hire, and it builds your plan.</p>
          </div>
          <ol className={styles.steps}>
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className={styles.stepNum}>Step {i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="product" aria-labelledby="product-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="product-title">
              Your follow-up, <em>written and waiting.</em>
            </h2>
            <p>Every text, email and reminder lands on one screen, with who it&apos;s for and why it matters today. Approve it, edit it or skip it. Shown here: the sample HVAC shop, College Park Heating &amp; Air.</p>
          </div>
          <figure className={styles.shot}>
            <div className={styles.bar}>anchored / approvals</div>
            <img src="/landing/approvals.png" alt="The Approvals page for the sample HVAC shop: drafts waiting for the owner, each with Approve, Edit and Skip, beside the outbox" width={1600} height={1000} loading="lazy" />
            <figcaption>
              <b>Approve, edit or skip</b>
              <span>Each message says who it&apos;s for and why now. Quiet hours and customer consent are checked before anything goes out.</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="agents" aria-labelledby="agents-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="agents-title">
              Help for every job <em>that slips.</em>
            </h2>
            <p>Anchored covers five parts of your business, each with its own helper. Switch on the ones you need. Every helper drafts, and none of them sends without you.</p>
          </div>
          <ul className={styles.crew}>
            {AGENT_ORDER.map((id) => {
              const agent = CORE_AGENTS[id];
              const covers = COVERS[id];
              return (
                <li key={id} className={styles.mate} style={{ "--pc": pennant(id) } as CSSProperties}>
                  <div className={styles.pic}>
                    <Boat symbol={BOAT_SYMBOL[id]} viewBox="0 0 200 140" />
                  </div>
                  <p className={styles.boatKind}>
                    {agent.name}
                    {agent.alwaysOn ? " · always on" : ""}
                  </p>
                  <h3>{covers.outcome}</h3>
                  <p>{covers.does}</p>
                  <ul className={styles.skills} aria-label={`What ${agent.name} covers`}>
                    {covers.tasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                  <p className={styles.never}>{covers.never}</p>
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
              From missed call <em>to paid invoice.</em>
            </h2>
            <p>One missed call should end in a booked job, a paid invoice and a five-star review. Anchored follows the customer the whole way, and every message comes back to you first.</p>
          </div>
          <FleetChart />
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="day" aria-labelledby="day-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="day-title">
              You approve <em>every message.</em>
            </h2>
            <p>Here&apos;s a Tuesday at a sample HVAC shop. Anchored drafts from 7 a.m. to 8 p.m. Every text waits for the owner&apos;s tap, and one approved after 8 p.m. waits until morning.</p>
          </div>
          <WatchBill />
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="tools" aria-labelledby="tools-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="tools-title">
              Use what you pay for <em>before buying more.</em>
            </h2>
            <p>76% of small businesses use AI, but only 14% say it&apos;s built into how they run, a 2026 Goldman Sachs survey found. Anchored starts from the tools you already have and suggests a new one only when it pays off.</p>
          </div>
          <ul className={styles.paths}>
            {PATHS.map((path) => (
              <li key={path.label}>
                <span className={styles.pathLabel}>{path.label}</span>
                <h3>{path.title}</h3>
                <p>{path.text}</p>
                <span className={styles.cost}>{path.cost}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="trades" aria-labelledby="trades-title">
        <div className={styles.inner}>
          <div className={styles.secHead}>
            <h2 id="trades-title">
              Built for the way <em>your trade works.</em>
            </h2>
            <p>Anchored was designed from research into four kinds of small business. It works the same way for any shop where customers call, text or email.</p>
          </div>
          <ul className={styles.trades}>
            {TRADES.map(({ trade, jobs, sample }) => (
              <li key={trade}>
                <h3>{trade}</h3>
                <ul className={styles.jobs}>
                  {jobs.map((job) => (
                    <li key={job}>{job}</li>
                  ))}
                </ul>
                {sample && <p className={styles.sample}>Sample business: {sample}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="rules" aria-labelledby="rules-title">
        <div className={`${styles.inner} ${styles.split}`}>
          <div>
            <p className={styles.eyebrow}>Safe by default</p>
            <h2 id="rules-title" className={styles.splitTitle}>
              You stay <em>in charge.</em>
            </h2>
            <p className={styles.splitText}>Your name is on every message, so Anchored follows the rules a careful office manager would.</p>
          </div>
          <ul className={styles.rules}>
            <li>
              <b>Nothing sends without your OK.</b> Every text, email and post waits for your tap.
            </li>
            <li>
              <b>No texts after 8 p.m.</b> Maryland bars telephone solicitations from 8 p.m. to 8 a.m., so a text approved late waits for morning.
            </li>
            <li>
              <b>Only customers who said yes.</b> A customer with no consent on file never gets a text, and replying STOP always works.
            </li>
            <li>
              <b>Some questions always go to you.</b> Anchored never answers allergy questions or quotes a price in a first reply.
            </li>
            <li>
              <b>Your data stays yours.</b> Delete your businesses at any time and their data goes with them.
            </li>
          </ul>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="pricing" aria-labelledby="pricing-title">
        <div className={`${styles.inner} ${styles.split}`}>
          <div>
            <p className={styles.eyebrow}>Pricing</p>
            <h2 id="pricing-title" className={styles.splitTitle}>
              One plan. <em>$29 a month.</em>
            </h2>
            <p className={styles.splitText}>Keep the tools you already pay for. Your plan lists Anchored next to every tool you keep or buy, so you see the full monthly total before you switch anything on.</p>
            <p className={styles.roi}>
              <b>$348 a year</b> is less than one average catering order of $420.
              <cite>ezCater, 2025</cite>
            </p>
          </div>
          <div className={styles.priceCard}>
            <p className={styles.amount}>
              $29<small>a month</small>
            </p>
            <p className={styles.priceFor}>One plan for the whole business</p>
            <ul className={styles.included}>
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link className={`${styles.btn} ${styles.ghost} ${styles.priceBtn}`} href={NEW_BUSINESS_HREF}>
              Set up my business
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.blk} ${styles.pad}`} id="faq" aria-labelledby="faq-title">
        <div className={`${styles.inner} ${styles.split}`}>
          <div>
            <p className={styles.eyebrow}>Questions</p>
            <h2 id="faq-title" className={styles.splitTitle}>
              What owners <em>want to know.</em>
            </h2>
          </div>
          <div className={styles.faq}>
            {FAQ.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.end} ${styles.pad}`} aria-labelledby="end-title">
        <div className={styles.inner}>
          <Boat symbol="boat-anchor" viewBox="0 0 120 150" className={styles.anchor} />
          <h2 id="end-title">Drop anchor on busywork.</h2>
          <p>Answer a few questions about your business. Anchored shows where AI fits, what it costs, and what it can take off your plate. Skip anything you don&apos;t know.</p>
          <Link className={`${styles.btn} ${styles.primary} ${styles.endBtn}`} href={NEW_BUSINESS_HREF}>
            Set up my business
          </Link>
        </div>
      </section>
      <footer className={`${styles.foot} ${styles.pad}`}>
        <span>Built for the University of Maryland AI for Small Business Hack-a-thon, Fall 2026.</span>
        <span>The sample businesses are fictional.</span>
        <Link href="/built">How it&apos;s built</Link>
      </footer>
    </div>
  );
}
