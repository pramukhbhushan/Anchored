# Connectors

A connector carries real events into Anchored and approved messages out of it. The owner still approves every send. This page lists the connectors that exist, the rules they share, and the ones researched but not built.

Sources are the team's research notes in `docs/research/` and vendor pages checked in November 2026. CL means [connectors_and_limits.md](research/corner-stores-and-restaurants-notes/connectors_and_limits.md), and TI means [tools_and_ingestion.md](research/corner-stores-and-restaurants-notes/tools_and_ingestion.md).

## Built

Each adapter lives in `lib/connectors/`. [Connect real services](deploy.md#connect-real-services) sets each one up.

| Connector | File | What it does | Feeds |
| --- | --- | --- | --- |
| Outbound email through Resend | `email.ts` | Sends an approved email with the owner's own Resend key and from-address, under the business's name, with the owner as reply-to. A self-hosted server can set one shared sender instead | Email cards, such as Payment Nudger reminders |
| Inbound email through Postmark | `email.ts` | Reads email the owner forwards to their business's address | Internal Communications triage |
| Twilio | `twilio.ts` | Sends approved texts from the owner's Twilio number, receives replies and STOP, and answers missed calls. Calls are never recorded or transcribed | Callback and the other texting skills |
| Stripe | `stripe.ts` | Reads `invoice.overdue` and `invoice.payment_failed` events from the owner's Stripe account. Never charges a card | Payment Nudger |
| Telegram, optional | `telegram.ts` | One shared bot: customers message a business through its link, and approved replies go back. Off unless the server sets `TELEGRAM_BOT_TOKEN`, and not verified in production | Customer |

Twilio, Resend, Postmark and Stripe are connected per business on the Connections page, stored as one row per business in the `connections` table with the credentials encrypted. The Telegram link is set up from the Customer page.

## Rules every connector follows

- **`checkSend` gates every send, twice.** `decideCard` runs it when the owner approves, and `lib/server/dispatch.ts` runs it again at send time. A queued text can cross into quiet hours, and a customer can text STOP after the owner approves.
- **Consent is recorded.** Contacts carry a consent source, and dispatch sends a text only to a number with a consent record and no STOP.
- **Only signed-in accounts connect a service.** A guest's only credential is the session cookie, and the retention job deletes guest rows after 30 days.
- **Webhooks prove who sent them.** Each route under `app/api/hooks/` verifies the provider's signature or secret, then finds the business by its connection with `Store.findConnection`, never by session.
- **One ingest path.** Webhooks and the simulator both turn events into cards through `lib/server/ingest.ts`.
- **The outbox is a queue.** Each entry has a delivery state and the provider's message id. `GET /api/cron/dispatch` picks the due entries and sends them.

## Rules that touch sending

- **Texts:**
  - Get prior express consent for informational texts and written consent for promotional ones.
  - The first text carries the STOP line.
  - Honor a revoked consent within 10 business days.
  - Maryland bars solicitations from 8 p.m. to 8 a.m., and the same subject more than 3 times in 24 hours.
  - Tobacco and vape texts are banned outright, and a rejected campaign can't be resubmitted. (CL, "TCPA, FCC rules and A2P 10DLC")
- **Calls:** Maryland requires every party's consent to record a call, so Anchored never records or transcribes one. (CL, "Maryland call recording")
- **Reviews:** Google allows automated replies only with the owner's "prior specific and express consent." Review content is kept at most 30 days. The FTC rule bans incentives tied to ratings. (CL, "Google Business Profile" and "FTC fake review rule")
- **Allergies:** Anchored never drafts an allergy reply, and the thread stays locked until the owner writes it.
- **Not researched yet:** CAN-SPAM for marketing email, and state AI disclosure laws. CL says to disclose by default.

## Not built

| Connector | Would feed | Access needed | Wait |
| --- | --- | --- | --- |
| Google Calendar read, or Calendly webhooks | Show-up Keeper | Google sensitive-scope verification for Calendar | Not researched |
| Square sandbox, then real sellers | Restaurants and stores: orders, catering | Free sandbox with a seed script. Unclear whether a real seller needs a Marketplace listing | Unknown |
| Jobber quotes | Closer, Debrief | Not researched | Unknown |
| Google Business Profile: reviews in, replies and posts out | Review Drafter, Post Drafter | A verified profile at least 60 days old, plus an access application. Quota stays at 0 until approved | Google says within 14 days |
| Meta: Instagram DMs, Lead Ads, posts | Inquiry Responder, Post Drafter | Business verification plus App Review | About 2 days to 3.5 months reported |
| Gmail read, Toast, Clover, QuickBooks | | `gmail.readonly` needs a yearly CASA audit. Toast's partner path takes months. Clover's wait is unknown. QuickBooks needs an assessment questionnaire | Skipped for now |

Gmail send is a sensitive scope that needs Google's app verification but no security audit. It could replace Resend if owners want mail to come from their own Gmail.

Texting from Twilio needs a paid account and A2P 10DLC registration. A sole proprietor without an EIN registers as Sole Proprietor; anyone else needs Low Volume Standard or the ISV setup. Twilio estimates about 4 days, and Azure's general figures are 2 to 3 business days for a brand, then 3 to 5 for a campaign.

## Open questions

1. **Who is the texting sender?** Today each owner brings their own Twilio account. One Anchored ISV registration with a profile per business would change the A2P cost and paperwork, and nobody has researched that path.
2. **Does a missed call count as an inquiry under Maryland's single-reply exemption?** CL marks this unsettled. Get a lawyer's answer before Callback texts on its own.
