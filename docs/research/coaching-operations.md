# Coaching Businesses: Operations, Pain Points & Backroom Ingestion

Nov 7, 2026 · @Pramukh Bhushan

## TL;DR

Coaching is a strong second vertical for Backroom because a coach's biggest pain is the same loop already built for Tom: answering leads fast and following up until they pay.

- **Who they are.** About 123,000 coaches worldwide, mostly solo, charging about $234 to $256 an hour. 72% feel successful but only 44% say they're profitable, and 77% see themselves as coaches, not entrepreneurs.
- **How they sell.** Everything funnels into a free discovery or sales call. Referrals and LinkedIn drive practice coaches; Instagram content, DMs and ads drive online coaches.
- **What they use.** No single CRM. A typical stack is 4 to 6 tools (Calendly, Stripe, Kajabi or Paperbell, an email tool, Zapier) at about $260 a month, and a Google Sheet is often the real CRM. High-ticket coaches use GoHighLevel.
- **Where it breaks.** Leads arrive while the coach is in session or in DMs no tool captures. Replies come hours late, discovery-call no-shows can hit 50%, and "let me think about it" rarely gets chased.
- **What Backroom does.** Hire a coach crew of Inquiry Responder, Call Follow-up, Show-up Keeper, Payment Nudger and Retention Watch. The first two are Tom's Lead Runner and Quote Chaser with a coaching profile.
- **How we ingest.** A 10-minute, 7-step onboarding: voice interview, website read, profile confirm, CSV or DM import, live sources, crew. Every source normalizes into one lead record through the existing `/api/ingest/*` path.
- **Hackathon move.** Add a coach as a seeded third persona. It needs one `details` JSON field on `leads`, coaching stages, and a DM-paste ingest.

## How coaching businesses are structured

Most coaching businesses are one person selling their own time and expertise, which is why admin and follow-up land on the same person who delivers the coaching. The [ICF 2025 Global Coaching Study](https://coachingfederation.org/blog/coaching-industry-continues-global-growth-with-5-34-billion-usd-revenue-new-research-reveals/) (PwC, 10,000+ respondents in 127 countries) counts 122,974 coach practitioners and $5.34B in revenue, up 15% in practitioners since 2023.

| Fact | Number | Source |
| --- | --- | --- |
| Average fee for a 1-hour session | $234 to $256 | [ICF/PwC 2025 exec summary](https://fidaghoficial.org/wp-content/uploads/2025/11/2025-ICF-Global-Coaching-Study_EXECUTIVE-SUMMARY.pdf), [Robin Waite report](https://robinwaite.com/coaching-industry-report) |
| Active clients at any time | 12 to 13 | [Robin Waite report](https://robinwaite.com/coaching-industry-report) |
| Specialize in leadership or executive coaching | 54% | [ICF 2025 release](https://coachingfederation.org/blog/coaching-industry-continues-global-growth-with-5-34-billion-usd-revenue-new-research-reveals/) |
| Also sell training, consulting, facilitation | 60%, 57%, 55% | [ICF 2025 release](https://coachingfederation.org/blog/coaching-industry-continues-global-growth-with-5-34-billion-usd-revenue-new-research-reveals/) |
| Offer group coaching | 62% | [upcoach survey](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023) |
| Feel successful vs. practice is profitable | 72% vs. 44% | [Onwards Consulting via BusinessWire](https://www.businesswire.com/news/home/20250414535483/en) |
| See themselves as coaches, not entrepreneurs | 77% | [Onwards Consulting via BusinessWire](https://www.businesswire.com/news/home/20250414535483/en) |

The last two rows matter most for Backroom. Coaches are good at coaching and see themselves as coaches, so the business side (prospecting, follow-up, billing) is underinvested. The same study names "underinvestment in business development" as a top challenge.

There are two broad segments, and they run their businesses very differently:

- **Practice coaches** (executive, life, career, wellness). 1:1 packages of 3 to 6 months, referral-driven, often a client-management tool like Paperbell, Practice or Satori plus Calendly and Stripe.
- **Online / high-ticket coaches** (business, fitness, mindset programs at $2k to $10k+). Content plus DM or ad funnels into booked sales calls, often on GoHighLevel, Kajabi or Skool, sometimes with a hired appointment setter and closer.

## How they sell and market

Almost every coaching sale runs through one conversation: a free discovery call (15 to 30 minutes) or, for high-ticket programs, an application followed by a sales call. Everything upstream exists to book that call, and everything downstream is follow-up until the prospect pays.

The standard sales path looks like this:

1. **Attention.** Content on LinkedIn, Instagram, YouTube or a newsletter, plus referrals from past clients.
2. **Capture.** A lead magnet (quiz, PDF, free training), a DM conversation, or an inquiry form. Online coaches add an application form to qualify.
3. **Book.** A Calendly or built-in booking link. Some coaches, like [Stacey Boehman](https://staceyboehman.com/?p=8025), deliberately message prospects personally and offer specific times instead.
4. **Remind and show up.** Email plus SMS reminders at 24 hours and 1 hour, with pre-call homework. [Paperbell](https://paperbell.com/blog/how-to-deal-with-no-shows/) says cold-traffic show rates can fall to about 50%.
5. **Discovery or sales call.** Diagnose, paint the outcome, present one to three packages (for example 3- or 6-month plans).
6. **Follow-up to close.** Proposal or checkout link, then chasing "let me think about it" and "I need to ask my partner".
7. **Onboard.** Contract, payment, intake form, welcome email, first session booked.

Marketing tactics that recur across sources:

- **Referrals beat everything for practice coaches.** In the [upcoach survey](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023), 35% of coaches call referral programs their most effective growth strategy and 98% of clients referred at least one person.
- **Clients search before they buy.** The same survey found 75% of clients find coaches through Google or social media, and 68% think about it for weeks before signing. That long consideration window is why nurture and follow-up matter.
- **Video and social proof.** Short educational clips, testimonials and case studies are the main lead magnets ([Robin Waite](https://robinwaite.com/coaching-industry-report)).
- **Standard packages instead of custom quotes.** Fixed packages cut the time spent building a custom offer for every prospect ([Robin Waite](https://www.robinwaite.com/blog/how-to-streamline-the-business-side-of-coaching-so-you-can-focus-on-clients)).
- **B2B sales cycles are getting longer.** Executive and business coaches sell into companies where cycles keep lengthening, so they lean on short starter packages and steady touchpoints.

Pricing pressure is real. The [Onwards Consulting study](https://www.businesswire.com/news/home/20250414535483/en) reports fees trending lower because of platforms and commoditization, which pushes coaches to sell more volume. More volume means more leads to answer and more follow-ups to send.

## CRMs and tool stack

Coaches rarely run one CRM. Most stitch together 4 to 6 tools ([FitBudd](https://www.fitbudd.com/insights/coaching-tech-stack)), and 38% run their programs across multiple platforms ([upcoach](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023)). A typical online-coach stack is Kajabi, Calendly, Kit, Zapier, Stripe and Notion at about $260 a month before the first client signs ([CreatorFlow](https://creatorflow.so/blog/coaching-tech-stack-audit/)).

| Tool | Type | Who uses it | What Backroom can pull from it | Price |
| --- | --- | --- | --- | --- |
| [GoHighLevel](https://www.learningrevolution.net/gohighevel-review/) | All-in-one CRM, SMS, funnels, workflows | High-ticket online coaches, agencies | Contacts, pipeline stages (Applied, Booked, No-Show, Enrolled), conversations, webhooks | $97 to $497/mo + usage |
| [HoneyBook](https://agiled.app/blog/best-crm-for-coaches) | Client flow and invoicing | Multi-service coaches, consultants | Inquiries, proposals, invoices, payment status | $36 to $129/mo |
| [Dubsado](https://agiled.app/blog/best-crm-for-coaches) | Client flow with conditional workflows | Established coaches | Leads, forms, contracts, invoices | $40 to $70/mo |
| [Paperbell](https://agiled.app/blog/best-crm-for-coaches) | Coaching platform: packages, booking, checkout | Solo and group coaches selling packages | Clients, packages, bookings, payments | Free to $97/mo |
| [Practice, Satori](https://agiled.app/blog/best-crm-for-coaches) | Coaching platform with client portal | Life and business coaches | Clients, sessions, intake forms | $39 to $99/mo |
| [CoachAccountable](https://agiled.app/blog/best-crm-for-coaches) | Accountability and progress tracking | Solo coaches | Clients, action items, metrics | $20 to $90/mo |
| Kajabi, Skool | Course plus community | Online program coaches | Members, purchases, community activity | Kajabi from $179/mo |
| Calendly | Scheduling | Nearly everyone | Booked, cancelled and no-show events with intake answers | $12/mo |
| Stripe | Payments | Nearly everyone | Customers, charges, failed payments, subscriptions | % of sales |
| Kit, Mailchimp | Email list | Content-led coaches | Subscribers, tags, opens | from $39/mo |
| Google Sheets, Notion | The "real" CRM for many solo coaches | Practice coaches | Lead lists, client trackers, session notes | Free |
| Instagram, LinkedIn DMs | Where conversations actually start | Everyone | DM threads (hard to reach by API) | Free |

The key finding for ingestion: the CRM is often not the system of record. For many practice coaches it is a spreadsheet plus their inbox and calendar, and for online coaches the first touch happens in Instagram DMs, outside every tool. Even GoHighLevel users report fragile workflows that break when a tag or form name changes, plus A2P 10DLC delays for SMS ([Learning Revolution](https://www.learningrevolution.net/gohighevel-review/)).

## How they generate leads

Referrals and personal networks are the top channel for practice coaches, and content plus DMs is the top channel for online coaches. Paid ads matter mainly for high-ticket programs, and they bring cold traffic that no-shows more often.

| Channel | Who relies on it | Evidence | What the lead looks like when it arrives |
| --- | --- | --- | --- |
| Referrals and word of mouth | Practice coaches | 35% of coaches call referrals their most effective strategy; 98% of clients refer someone ([upcoach](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023)). Top channel in a [r/lifecoaching thread](https://redlib.cypherpunktools.com/r/lifecoaching/comments/1jswers/curious_how_do_your_clients_find_you) | A text, email or intro from a past client |
| LinkedIn content and DMs | Executive, career, business coaches | Tied for top in the [r/lifecoaching thread](https://redlib.cypherpunktools.com/r/lifecoaching/comments/1jswers/curious_how_do_your_clients_find_you) | A comment or DM, then a booked call |
| Instagram, TikTok, YouTube | Online and fitness coaches | 75% of clients find coaches through Google or social ([upcoach](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023)); video called the strongest trust builder ([Robin Waite](https://robinwaite.com/coaching-industry-report)) | A DM keyword ("comment GUIDE"), a quiz or lead-magnet opt-in |
| Website and SEO | Practice coaches | Named as weak and hard to get right in the [r/lifecoaching thread](https://redlib.cypherpunktools.com/r/lifecoaching/comments/1jswers/curious_how_do_your_clients_find_you) | Contact form or booking-page inquiry |
| Paid ads (Meta lead ads, YouTube) | High-ticket online coaches | Cold traffic show rates can fall to about 50% ([Paperbell](https://paperbell.com/blog/how-to-deal-with-no-shows/)) | Lead-form submission or application, often outside work hours |
| Networking, events, workshops | Practice and B2B coaches | Mentioned in the [r/lifecoaching thread](https://redlib.cypherpunktools.com/r/lifecoaching/comments/1jswers/curious_how_do_your_clients_find_you) | Business cards and names in a notes app |
| Marketplaces (Noomii, BetterUp) | Newer coaches | Listings "don't guarantee leads" (same thread) | Platform message |

Two details matter for Backroom. First, only about 17% of coaches actively invest in inbound marketing ([upcoach](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023)), so most leads come in through messy personal channels, not clean forms. Second, 75% of Meta lead-ad leads arrive outside weekday 9-to-5 hours ([LeadSync via Ainora](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026)), which is when a solo coach is in sessions or offline.

## How they follow up, and where leads leak

Follow-up is the weakest link and the one with the clearest payoff. A solo coach in back-to-back sessions cannot reply in five minutes, and the research says the first hour decides most outcomes.

- **Speed to lead.** Calling within 5 minutes instead of 30 makes contact about 100x more likely and qualification about 21x more likely ([MIT/InsideSales, Oldroyd](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026)). Firms replying within an hour were nearly 7x as likely to qualify a lead, and 23% of firms never replied at all ([HBR 2011](https://hbr.org/2011/03/the-short-life-of-online-sales-leads)).
- **Persistence.** 93% of converted leads were reached by the sixth attempt, and 6 calls plus 5 emails performed best ([Velocify via Ainora](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026)).
- **Long decisions.** 68% of coaching clients consider it for at least a few weeks before signing ([upcoach](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023)), so a lead that goes quiet is usually still warm.
- **Handoff delay.** Copying a lead between Instagram, Calendly, email and the CRM adds about 2.4 hours of weekly delay in one coach's example; "latency lives in the handoffs, not the tools" ([CreatorFlow](https://creatorflow.so/blog/coaching-tech-stack-audit/)).

The leak points follow [Stacey Boehman's](https://staceyboehman.com/?p=8025) eight phases, from "no one books" to "finish but don't renew". Each one needs a different follow-up message:

| Leak point | What usually happens today | The follow-up that fixes it |
| --- | --- | --- |
| New inquiry or DM | Answered hours or days later, between sessions | Personal reply in minutes with a booking link or two specific times |
| Booked but no-show | One calendar invite, then nothing | 24h and 1h reminders by email and SMS, pre-call homework, an easy reschedule link ([Paperbell](https://paperbell.com/blog/how-to-deal-with-no-shows/)) |
| Showed, "let me think" | Coach waits, feels awkward chasing | Recap of the call with the package and link, then day 1, 3 and 7 check-ins |
| Said yes, didn't pay | Invoice sits unpaid | Payment reminder plus a personal nudge |
| Mid-program drop-off | Noticed only when the client stops booking | Check-in when a session is missed or homework lapses; 62% of clients want more accountability ([upcoach](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023)) |
| Program ends | No renewal ask, no referral ask | Renewal offer, testimonial request, referral request |
| Old leads | Sit in a spreadsheet forever | Monthly reactivation message with something useful |

This maps almost one to one onto Backroom's hero flow. Tom's Lead Runner and Quote Chaser become a coach's Inquiry Responder and Discovery Call Follow-up.

## Pain points: the day-to-day manual work

A coach's paid hours are sessions, but their unpaid hours are messages, scheduling, chasing and notes. In the [upcoach survey](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023), 58% of coaches spend 2+ hours a week on admin and 28% spend 5+; among coaches charging $200+ an hour, 74% spend 2+ hours. In [ICF's practice research](https://coachingfederation.org/wp-content/uploads/2025/02/icf-research-coaching-time-management.pdf), external coaches rank preparing invoices and maintaining client records as their top admin tasks, and following up on sales leads ranks fifth of 28 business-development tasks.

**A typical day for a solo coach** (a composite built from the sources in this section, not a single survey):

| Time | What they do | Manual? | Why it hurts |
| --- | --- | --- | --- |
| 7:30 | Scan email, Instagram and LinkedIn DMs for overnight inquiries | Yes | Leads arrive in 3 to 4 inboxes; 75% of ad leads come outside 9-to-5 |
| 8:00 | Reply to inquiries, send booking links, copy names into a sheet or CRM | Yes | Each handoff between tools delays the lead ([CreatorFlow](https://creatorflow.so/blog/coaching-tech-stack-audit/)) |
| 8:30 | Reschedule two sessions, sort time zones | Yes | "Five messages just to confirm one session" ([Robin Waite](https://www.robinwaite.com/blog/how-to-streamline-the-business-side-of-coaching-so-you-can-focus-on-clients)) |
| 9:00 to 12:00 | Client sessions | No (the real work) | New leads go cold while they coach |
| 12:00 | Write session notes, action items, recap emails | Yes | Notes end up scattered across files ([Robin Waite](https://www.robinwaite.com/blog/how-to-streamline-the-business-side-of-coaching-so-you-can-focus-on-clients)) |
| 12:30 | Discovery call, then a follow-up email with packages | Partly | Follow-ups slip when the day gets busy |
| 14:00 to 16:00 | More sessions | No |  |
| 16:00 | Chase unpaid invoices, send contracts and intake forms to new clients | Yes | Invoicing is the top-ranked admin task ([ICF](https://coachingfederation.org/wp-content/uploads/2025/02/icf-research-coaching-time-management.pdf)) |
| 16:30 | Check in on quiet clients, nudge homework | Yes | 62% of clients want more accountability ([upcoach](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023)) |
| 17:00 | Write and schedule tomorrow's post | Yes | About 5 hours a week even when batched ([Robin Waite](https://www.robinwaite.com/blog/how-to-streamline-the-business-side-of-coaching-so-you-can-focus-on-clients)) |
| 21:00 | Reply to DMs from the couch | Yes | The business never switches off |

The pain points, ranked by how directly they cost revenue:

1. **Slow or missed replies to new leads.** Leads arrive while the coach is in session, and every hour of delay cuts qualification odds ([HBR](https://hbr.org/2011/03/the-short-life-of-online-sales-leads)).
2. **No consistent follow-up after discovery calls.** Coaches feel awkward chasing, so "let me think about it" becomes a lost sale.
3. **No-shows on discovery calls.** Up to half of cold-traffic bookings can no-show ([Paperbell](https://paperbell.com/blog/how-to-deal-with-no-shows/)).
4. **Scheduling and rescheduling back-and-forth.**
5. **Onboarding paperwork.** Contract, payment, intake form, welcome email, first booking.
6. **Invoicing and payment chasing.**
7. **Session notes and recap emails.**
8. **Client retention.** Spotting disengaged clients before they quit, and asking for renewals and referrals at the end.
9. **Content creation.** Daily posts to keep the top of the funnel alive.
10. **Tool sprawl.** 4 to 6 tools, $260 a month, Zapier glue that breaks ([CreatorFlow](https://creatorflow.so/blog/coaching-tech-stack-audit/), [FitBudd](https://www.fitbudd.com/insights/coaching-tech-stack)).

This is the operator trap from the blueprint in coaching form. Only 44% of coaches say their practice is profitable ([Onwards Consulting](https://www.businesswire.com/news/home/20250414535483/en)), and the hours that would fix that (business development) are the ones eaten by admin.

## How Backroom solves it: a coach's crew

For a coach, the router should hire five agents, and the first two are the same lead follow-up loop already built for Tom. Each agent is one SKILL.md that writes a `propose_card`, and the Executor still runs nothing until the coach taps Approve.

| Pain point | Backroom agent | Layer | Example card | Executor action |
| --- | --- | --- | --- | --- |
| Slow replies to new leads | **Inquiry Responder** (Lead Runner reskinned) | Automation | "New lead: Priya, career change, from IG. Send this + 2 call times?" | `send_sms` or `send_email` |
| No follow-up after discovery calls | **Call Follow-up** (Quote Chaser reskinned) | Automation | "Priya said 'let me think' on Tuesday. Day 3 check-in?" | `send_email`, schedule day 1/3/7 cards |
| No-shows | **Show-up Keeper** | Automation | "Call with Sam tomorrow 10am. Send reminder + prep questions?" | `send_sms` |
| Onboarding paperwork | **Onboarding Clerk** | Automation | "Priya paid. Send welcome, contract and intake form?" | `send_email`, `update_lead` (stage = Client) |
| Invoices and late payments | **Payment Nudger** | Data + Automation | "Jordan's invoice is 9 days late. Send friendly reminder?" | `send_email` |
| Session notes and recaps | **Session Scribe** | Intelligence | "Recap for Alex's session: 3 action items. Send?" | `send_email`, `append_sheet_row` |
| Disengaged clients, renewals, referrals | **Retention Watch** | Intelligence | "Dana missed 2 sessions. Check in?" / "Lee finishes in 2 weeks. Ask for renewal + referral?" | `send_sms` |
| Knowing what matters today | **Morning Brief** | Intelligence | "2 new leads, 1 call to follow up, 1 late invoice, 4 sessions" | none (read-only) |
| Time back | **Hours back** | Build | "You got 5.5 hours back this week. Use it for 2 LinkedIn posts?" | none |

**The coach hero flow** reuses the exact Tom loop, so it costs almost nothing to add as a third persona:

1. **Onboarding.** The coach says: "I'm a career coach, I sell a 3-month package for $1,800, leads come from LinkedIn and Instagram, I'm in sessions all day and forget to follow up after discovery calls." The router hires Inquiry Responder, Call Follow-up, Show-up Keeper and Payment Nudger.
2. **A lead lands** through `/api/ingest/lead` (a "Book a free clarity call" form).
3. **Inquiry Responder** drafts a reply in the coach's voice with two specific times, which follows Stacey Boehman's advice to offer times instead of a cold link.
4. **Coach taps Approve** between sessions. Speed to lead shows on the KPI strip.
5. **The lead replies** with a time. The card updates the lead to Booked and the Show-up Keeper queues 24h and 1h reminders.
6. **After the call** the coach taps "Said let me think" and Call Follow-up schedules day 1, 3 and 7 cards.

**Data model changes are small.** Generalize `leads.move_date` and `leads.size` into a `details` JSON so coaching fields (goal, package interest, source channel, call time) fit. Add stages `New, Contacted, Booked, Showed, No-show, Proposal, Client, Lost`. Add one action type, `send_booking_link`, or keep it as text inside `send_sms`.

**KPIs for coaches.** Speed to lead, discovery-call show rate, follow-ups sent, proposal-to-client rate, and hours back. Show rate and proposal-to-client are the two numbers a coach will feel in revenue.

## Ingestion: what to pull in and where it lands

Ingest in two passes. The first pass builds the Business Profile (who the coach is and how they sound). The second pass feeds live events into the same `/api/ingest/*` path the blueprint already uses for Tom, so every new source is one more `events.source` value, not a new pipeline.

**Pass 1: context (runs once at onboarding)**

| What | How we get it | Lands in | Used by |
| --- | --- | --- | --- |
| Niche, offers, packages, prices | 60-second voice intro, plus the coach's website or sales-page URL that Claude reads | `businesses.profile` (context layer) | Every agent |
| Tone of voice and sample phrases | Coach pastes 3 to 5 past replies or DMs they liked | `profile.voice` | Inquiry Responder, Call Follow-up |
| Sales process and stages | Voice intro: "how does someone become a client?" | `profile.pipeline` (stage names) | Router, all follow-up agents |
| Booking link, hours, time zone | Voice intro or Calendly URL | `profile.booking` | Inquiry Responder, Show-up Keeper |
| Task audit (what eats their week) | Voice intro: "what do you hate doing every week?" | Router input; `crew.tasks_covered` | Automation % KPI |

**Pass 2: data and live events (ongoing)**

| Source | Method | Hackathon? | `events.source` | Lands in | Layer |
| --- | --- | --- | --- | --- | --- |
| Existing leads and clients (Google Sheet, CRM export) | CSV upload, Claude maps columns | Yes | `csv` | `leads` | Data |
| Website or lead-magnet form | Form posts to `/api/ingest/lead` | Yes (hero flow) | `lead_form` | `leads`, `events` | Data |
| SMS replies | Twilio inbound webhook | Yes | `sms_in` | `messages` | Data |
| Calendly bookings, cancels, no-shows | Calendly webhook | Stretch | `booking` | `leads.stage`, `events` | Data |
| Stripe payments and failed charges | Stripe webhook | Stretch | `payment` | `leads.stage`, `events` | Data |
| GoHighLevel, HoneyBook, Dubsado | Their webhooks or a CSV export | Post-hackathon | `crm_sync` | `leads` | Data |
| Email inquiries | Gmail OAuth, or a forwarding address like `coach@in.backroom.app` | Forwarding address is a cheap stretch | `email_in` | `messages`, `leads` | Data |
| Instagram and LinkedIn DMs | Coach shares or screenshots a DM into Backroom; Claude extracts name, need and channel | Yes (share sheet or paste box) | `dm_paste` | `leads` | Data |
| Session notes or call transcripts | Paste or upload, or Zoom transcript later | Stretch | `transcript` | `events` | Intelligence |
| Scheduled checks (no reply in 3 days, invoice 7 days late) | Cron over `leads` and `events` | Yes | `cron` | `cards` | Automation |

The DM paste is the most important coaching-specific addition. The first touch for online coaches happens in Instagram or LinkedIn DMs, which no tool in their stack captures ([CreatorFlow](https://creatorflow.so/blog/coaching-tech-stack-audit/)), and Meta and LinkedIn DM APIs are hard to get approved. A share-to-Backroom button or a screenshot upload turns that blind spot into a lead record in seconds and keeps us off the cut list.

**Normalization rule.** Every source becomes the same lead record: `name, phone, email, source_channel, need, package_interest, stage, last_contact_at, next_step`. Claude does the mapping with a forced tool call, the same pattern as `propose_card`, so a messy spreadsheet header like "Ph #" or "where'd they find me" still maps cleanly.

## The repeatable ingestion workflow

The same seven steps onboard any coach in about 10 minutes, and the steps stay the same for any other vertical. Only the vertical template in step 1 changes.

1. **Pick the vertical template (automatic).** The router detects "coach" from the first sentence and loads the coaching template: default pipeline stages, the 5 interview questions below, default crew and sample cards.
2. **Voice interview (2 minutes).** Ask the template's five questions, one screen each:
   1. What do you sell, to whom, and for how much?
   2. Where do new clients come from?
   3. Walk me through how someone goes from first message to paying client.
   4. What do you do every week that you wish someone else did?
   5. Paste or say a reply you've sent a lead that sounds like you.
3. **Enrich from a link (30 seconds).** The coach pastes their website, sales page or Calendly URL. Claude reads it and fills offers, prices and the booking link. Output: a draft Business Profile.
4. **Confirm the profile (1 minute).** One "Here's your business" screen with packages, pipeline stages, voice sample and booking link, each editable. Nothing is saved as truth until the coach confirms.
5. **Import existing leads and clients (2 minutes).** Upload a CSV or Sheet export, or paste DMs. Claude maps columns to the standard lead record and shows a preview: "42 leads, 9 clients, 14 haven't heard from you in 30+ days." Those 14 become the first reactivation cards, so value shows up on day one.
6. **Connect live sources (2 minutes).** Turn on, in order of payoff: the lead form link (always), the Backroom SMS number (always), then Calendly and Stripe webhooks when available. Each connection is one toggle and one test event.
7. **Hire the crew and show the first cards.** The router reads the task audit, hires 4 or 5 agents with a one-line reason each, and the feed opens with real cards from the imported data. The KPI strip starts counting.

**After onboarding, the loop repeats on every event:** event in, normalize to a lead record, agent drafts a card, coach approves, Executor acts, event logged, KPI updated. A weekly 30-second check-in ("anything new this week?") updates the profile so context never goes stale.

**What makes it repeatable across coaches and verticals:**

- **One template file per vertical** holding stages, interview questions, default crew and the lead-record extras (for coaches: goal, package interest; for movers: move date, size).
- **One normalizer** (Claude with a forced schema) for every source, so a new CRM is a mapping, not new code.
- **One ingest path** (`/api/ingest/*` into `events`), which is the blueprint's existing design.
- **A quality bar per onboarding:** profile confirmed, at least 1 live source connected, at least 3 cards in the feed. If any is missing, the Morning Brief asks for it the next day.

For the hackathon, steps 1 to 5 and 7 are demoable with seeded coach data, and step 6 only needs the lead form and Twilio that Tom's loop already uses.

## Sources

All pages opened on November 7, 2026. Vendor sources (upcoach, Paperbell, Agiled, FitBudd, CreatorFlow) sell coaching software, so their numbers lean toward their products.

- [ICF 2025 Global Coaching Study release](https://coachingfederation.org/blog/coaching-industry-continues-global-growth-with-5-34-billion-usd-revenue-new-research-reveals/): practitioners, revenue, specialties
- [ICF/PwC 2025 Global Coaching Study, executive summary (third-party mirror)](https://fidaghoficial.org/wp-content/uploads/2025/11/2025-ICF-Global-Coaching-Study_EXECUTIVE-SUMMARY.pdf): $234 average hourly fee
- [ICF, How Coaches Spend Their Time (white paper)](https://coachingfederation.org/wp-content/uploads/2025/02/icf-research-coaching-time-management.pdf): admin and business-development task rankings
- [Onwards Consulting / Market Street Research via BusinessWire (April 2025)](https://www.businesswire.com/news/home/20250414535483/en): success vs. profitability, pricing pressure
- [upcoach coaching trends survey](https://upcoach.com/coaching-trends-and-the-future-of-coaching-new-data-for-2023): admin hours, referrals, client search behavior
- [Robin Waite, Coaching Industry Report 2025](https://robinwaite.com/coaching-industry-report): fees, client load, marketing, challenges
- [Robin Waite, Streamline the business side of coaching](https://www.robinwaite.com/blog/how-to-streamline-the-business-side-of-coaching-so-you-can-focus-on-clients): manual task list
- [SchedulingKit, Coaching industry statistics](https://www.schedulingkit.com/statistics/coaching-industry-statistics): compiled fee and admin stats
- [Agiled, Best CRM for coaches (2026)](https://agiled.app/blog/best-crm-for-coaches): CRM comparison and pricing
- [Learning Revolution, GoHighLevel for coaches (2026)](https://www.learningrevolution.net/gohighevel-review/): GHL features, pricing, pain points
- [CreatorFlow, Coaching tech stack audit](https://creatorflow.so/blog/coaching-tech-stack-audit/): typical stack, cost, handoff delays
- [FitBudd, 2026 coaching tech stack](https://www.fitbudd.com/insights/coaching-tech-stack): 4 to 6 tools per coach
- [Paperbell, How to deal with no-shows](https://paperbell.com/blog/how-to-deal-with-no-shows/): no-show causes and reminder practice
- [Stacey Boehman, Consult no-shows and the 8 problems](https://staceyboehman.com/?p=8025): leak points in the coaching sales cycle
- [r/lifecoaching, How do your clients find you?](https://redlib.cypherpunktools.com/r/lifecoaching/comments/1jswers/curious_how_do_your_clients_find_you): channels in coaches' own words
- [Ainora, Lead response time: every study](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026): MIT/InsideSales, Velocify, Drift, LeadSync figures
- [HBR, The Short Life of Online Sales Leads (2011)](https://hbr.org/2011/03/the-short-life-of-online-sales-leads): 1-hour response finding
- Backroom blueprint, the team's internal design document: architecture this plan builds on
