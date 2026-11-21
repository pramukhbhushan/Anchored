import Link from "next/link";
import type { CSSProperties } from "react";
import { BOAT_SYMBOL, Boat, BoatDefs, pennant } from "@/components/site/harbor/Boats";
import { DayBoard } from "@/components/site/harbor/DayBoard";
import { HarborHero } from "@/components/site/harbor/HarborHero";
import { PhoneDraft } from "@/components/site/harbor/PhoneDraft";
import { Receipt, type ReceiptLine } from "@/components/site/harbor/Receipt";
import { ScoutFind } from "@/components/site/harbor/ScoutFind";
import styles from "@/components/site/harbor/harbor.module.css";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { CORE_AGENTS } from "@/lib/domain/agents";
import type { CoreAgentId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page, in the Harbor Chart design (docs/brand.md), written for
// an owner who is not technical. It shows instead of describes, using the
// app's own sample restaurant, Linden Street Kitchen: the hero where the tide
// rises, a catering reply waiting on a phone, the five jobs as boats on one
// waterline, a scout's find, a Tuesday board that plays the day, the real
// Approvals screen, the monthly plan as a receipt, the rules, common
// questions, and the anchor with the setup button.

const FLEET: readonly (readonly [id: CoreAgentId, job: string])[] = [
  ["frontdesk", "Answers requests"],
  ["followup", "Follows up"],
  ["books", "Gets you paid"],
  ["content", "Answers reviews"],
  ["internal", "Morning brief"],
];

/** The Linden Street Kitchen sample's plan, as the Stack page shows it. */
const PLAN: readonly ReceiptLine[] = [
  { job: "Booking reminders", by: "Your OpenTable", cost: "$0.00" },
  { job: "Review replies", by: "Your Google listing", cost: "$0.00" },
  { job: "Phone answering", by: "Certus", cost: "$250.00" },
  { job: "Delivery disputes", by: "Orders.co", cost: "$29.00" },
  { job: "Staff schedule", by: "Homebase, free plan", cost: "$0.00" },
  { job: "Catering, supplier prices, posts", by: "Anchored", cost: "$29.00" },
];

const RULES: readonly (readonly [rule: string, why: string])[] = [
  ["No texts after 8 p.m.", "Maryland bars sales calls and texts from 8 p.m. to 8 a.m. A late yes waits for morning."],
  ["Only customers who opted in.", "No consent on file, no text. Replying STOP always works."],
  ["Allergy and price questions come to you.", "Anchored never answers them for you."],
  ["Your customer list stays yours.", "Delete your business and its data goes with it."],
];

const FAQ: readonly (readonly [question: string, answer: string])[] = [
  ["How does Anchored learn about my business?", "You tell it in a short chat: what you do, who your customers are and the tools you use. It can also read your website to fill in the gaps. Skip anything you don't know."],
  ["How does it find the right tools?", "It matches each job in your business to tools checked by hand for price, what they do and whether they act without you. Scouts keep finding new ones, and a person reviews each before it shows up."],
  ["What will it actually do for me?", "It writes the messages that slip: replies to new requests, follow-ups, payment reminders and review replies. You approve each one. Where a tool you have or could buy does a job better, it points you there instead."],
  ["Will it text my customers without me?", "No. Every message waits for your tap."],
  ["Do I have to switch tools?", "No. It starts with the ones you already pay for."],
  ["Does it text from my number?", "Connect a business texting number and it sends from there. Without one, you tap Send and your phone's texting app opens with the words filled in."],
  ["What does it cost?", "Anchored starts at $29 a month. Tools you already use keep their own price, and adding one is up to you. Your plan shows the full monthly total before you turn anything on."],
  ["Who made this?", "Students at the University of Maryland, for the Fall 2026 AI for Small Business Hack-a-thon."],
];

/** Render the landing page. */
export default function HomePage() {
  return (
    <div className={styles.harbor}>
      <BoatDefs />
      <HarborHero>
        <h1>AI that fits how your business runs.</h1>
        <p className={styles.lede}>Anchored learns how your business runs today and fits AI right into it. When a new tool could speed you up, it finds it for you. You approve everything first.</p>
        <div className={styles.row}>
          <Link className={`${styles.btn} ${styles.primary}`} href={NEW_BUSINESS_HREF}>
            Try it on my business
          </Link>
          <a className={`${styles.btn} ${styles.ghost}`} href="#the-text">
            See what it writes
          </a>
        </div>
        <p className={styles.note}>Plans start at $29 a month. Nothing goes out until you tap send.</p>
      </HarborHero>

      <section className={`${styles.sec} ${styles.pad}`} id="the-text" aria-labelledby="text-title">
        <div className={`${styles.inner} ${styles.textGrid}`}>
          <div className={styles.textCopy}>
            <h2 id="text-title" className={styles.h2}>
              A catering request came in. The reply is already written.
            </h2>
            <p className={styles.say}>Read it, fix a word if you want, then tap Approve. Until you do, nothing goes out.</p>
            <p className={styles.research}>
              <b>Nearly 7 times.</b> That&apos;s how much likelier businesses were to get a real conversation going when they replied within the hour. Harvard Business Review, 2011.
            </p>
          </div>
          <PhoneDraft />
        </div>
      </section>

      <section className={`${styles.sec} ${styles.pad} ${styles.tight}`} id="jobs" aria-labelledby="jobs-title">
        <div className={styles.inner}>
          <div className={styles.fleetHead}>
            <h2 id="jobs-title" className={styles.h2}>
              Five jobs off your list.
            </h2>
            <p className={styles.say}>Turn on only the ones you need.</p>
          </div>
          <ul className={styles.fleet}>
            {FLEET.map(([id, job]) => (
              <li key={id} className={styles.boatFig} style={{ "--pc": pennant(id) } as CSSProperties}>
                <Boat symbol={BOAT_SYMBOL[id]} viewBox="0 0 200 140" className={styles.boatPic} />
                <svg className={styles.wl} viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 9 Q25 3 50 9 T100 9 T150 9 T200 9 T250 9 T300 9" />
                </svg>
                <h3>{job}</h3>
                <p>{CORE_AGENTS[id].name}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.sec} ${styles.pad} ${styles.tight}`} id="scouts" aria-labelledby="scouts-title">
        <div className={`${styles.inner} ${styles.scoutGrid}`}>
          <div className={styles.scoutCopy}>
            <h2 id="scouts-title" className={styles.h2}>
              New tools, found for your shop.
            </h2>
            <p className={styles.say}>Anchored&apos;s scouts look for AI tools that do one of your jobs. You only hear about the ones that check out.</p>
            <ul className={styles.points}>
              <li>
                <b>They search by job and trade.</b>
                <span>Catering at a restaurant, not every AI app out there.</span>
              </li>
              <li>
                <b>They read the real page.</b>
                <span>The price, what it does, and whether it acts without you.</span>
              </li>
              <li>
                <b>A person checks every find.</b>
                <span>Nothing reaches your plan unreviewed.</span>
              </li>
            </ul>
          </div>
          <ScoutFind />
        </div>
      </section>

      <section className={`${styles.sec} ${styles.pad}`} id="tuesday" aria-labelledby="day-title">
        <div className={styles.inner}>
          <div className={styles.boardHead}>
            <h2 id="day-title" className={styles.h2}>
              A Tuesday at Linden Street Kitchen.
            </h2>
            <p className={styles.say}>Every message waited for a yes. The allergy question went straight to the owner, and a text approved at 8:35 p.m. waited for morning.</p>
          </div>
          <DayBoard />
        </div>
      </section>

      <section className={`${styles.sec} ${styles.pad} ${styles.tight}`} id="inbox" aria-labelledby="inbox-title">
        <div className={`${styles.inner} ${styles.center}`}>
          <h2 id="inbox-title">This is the real app.</h2>
          <p className={styles.say}>The Linden Street Kitchen sample, with its drafts waiting for a yes. Open it yourself from the app.</p>
          <figure className={styles.shot}>
            <img src="/landing/approvals.png" alt="The Approvals page for the Linden Street Kitchen sample: drafts waiting for the owner, each with Approve, Edit and Skip" width={1600} height={1000} loading="lazy" />
          </figure>
        </div>
      </section>

      <section className={`${styles.sec} ${styles.pad}`} id="pricing" aria-labelledby="pricing-title">
        <div className={`${styles.inner} ${styles.billGrid}`}>
          <div className={styles.billCopy}>
            <h2 id="pricing-title" className={styles.h2}>
              Keep what you already pay for.
            </h2>
            <div className={styles.chat}>
              <p className={`${styles.cb} ${styles.them}`}>What do you use to run the restaurant today?</p>
              <p className={`${styles.cb} ${styles.me}`}>Clover, OpenTable and DoorDash.</p>
              <p className={`${styles.cb} ${styles.them}`}>Keep them. Anchored can take catering and supplier invoices.</p>
            </div>
            <p className={styles.price}>
              <span>From</span>
              <b>$29</b>
              <span>a month</span>
            </p>
            <p className={styles.priceNote}>That&apos;s Anchored itself. The tools you keep cost what they cost today, and adding a new one is your call. Your plan adds it all up before you turn anything on.</p>
          </div>
          <Receipt shop="Linden Street Kitchen" lines={PLAN} total="$308.00" />
        </div>
      </section>

      <section className={`${styles.sec} ${styles.pad} ${styles.tight}`} id="rules" aria-labelledby="rules-title">
        <div className={styles.inner}>
          <h2 id="rules-title" className={`${styles.h2} ${styles.rulesTitle}`}>
            Nothing goes out until you say so.
          </h2>
          <div className={styles.ruleGrid}>
            {RULES.map(([rule, why]) => (
              <div key={rule}>
                <p className={styles.ruleBig}>{rule}</p>
                <p className={styles.why}>{why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.sec} ${styles.pad} ${styles.tight}`} id="questions" aria-labelledby="faq-title">
        <div className={styles.faqWrap}>
          <h2 id="faq-title">Questions you&apos;d ask us.</h2>
          <div className={styles.faq}>
            {FAQ.map(([question, answer], i) => (
              <details key={question} open={i === 0}>
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
          <h2 id="end-title">Try it on your business.</h2>
          <p className={styles.say}>Tell it about your shop. See where AI fits and what it would write for you.</p>
          <Link className={`${styles.btn} ${styles.primary} ${styles.endBtn}`} href={NEW_BUSINESS_HREF}>
            Try it on my business
          </Link>
        </div>
      </section>
      <footer className={`${styles.foot} ${styles.pad}`}>
        <div className={`${styles.inner} ${styles.footIn}`}>
          <span>Built at the University of Maryland, Fall 2026.</span>
          <span>The sample business is made up.</span>
          <Link href="/built">How it&apos;s built</Link>
        </div>
      </footer>
    </div>
  );
}
