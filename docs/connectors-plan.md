# Connector plan

Drafted Nov 7, 2026, after `feat/ask-agents-in-chat`. Sources are the team's research notes in `docs/research/` and a few vendor pages checked the same day. CL means `docs/research/corner-stores-and-restaurants-notes/connectors_and_limits.md`, and TI means `tools_and_ingestion.md` in the same folder.

## Status

Built: the foundation below, forwarded email in, email out, Twilio missed calls and texting, and Stripe invoices. The README's "Connect real services" section sets each one up. Still planned: calendar bookings, Square, Jobber, Google Business Profile and Meta.

## Goal

Today an agent drafts a card, the owner approves it, and the owner sends it from their own phone or email. Connectors close both ends. Real events come in and become cards without the owner pasting anything. Approved cards go out without the owner copying them. The owner still approves every send.

## What stays true

- **`checkSend` still gates every send, and it runs again at send time.** A queued text can cross into quiet hours, and a customer can text STOP after the owner approves.
- **Consent becomes real.** `decideCard` passes `hasConsent: true` today. Connectors need contact records with a consent source, plus a STOP list that every send checks.
- **Only signed-in email or Google accounts can connect a service.** A guest's only credential is the session cookie, and the retention job deletes guest rows after 30 days.
- **Connectors sit in a new layer.** `lib/connectors/` holds one adapter per provider behind `Sender` and `EventSource` interfaces, the way `lib/llm` holds one adapter per model provider. Each adapter imports `server-only` and stores its tokens encrypted.
- **Webhooks prove who sent them.** Each webhook route verifies the provider's signature. It finds the business by phone number or forwarding address, never by session. `docs/security.md` already lists this under known limits.

## Foundation, before any connector (about 2 weeks)

1. **Contacts and consent.** Add a contacts table with each contact's consent source and date, a STOP list, and an informational or promotional tag per card. Then `checkSend` reads real consent.
2. **Connections.** Add a connections table holding the provider, the external id (phone number, address or account id), the encrypted credentials and a status. Add each new `Store` method to `types.ts`, `memory.ts` and `supabase.ts` together, and make `reset` clear the table.
3. **The outbox becomes a queue.** Add a status (queued, sent or failed), the provider's message id and an attempt count. A Vercel Cron job runs every few minutes. It picks due rows, runs `checkSend` again, sends through the adapter and records the result.
   - The job reads across sessions, so it needs one deployment-wide `Store` method, as `useAiCall` has. Name it in `docs/architecture.md`.
4. **One ingest path.** Move the flow in `app/api/ingest/[source]/route.ts` into `lib/server/ingest.ts`. Then webhooks and the simulator share it, and the "Known gaps" entry closes.

## Connectors in order

| Order | Connector | Feeds these agents | Access needed | Wait |
| --- | --- | --- | --- | --- |
| 1 | Forwarding address for inbound email, through a provider's inbound parse | Inbox Triage, Inquiry Responder, Catering, Price Watch (invoice PDFs) | None | None |
| 2 | Outbound email from Anchored through a transactional provider, with reply-to set to the owner | Inquiry Responder, Payment Nudger, Call Follow-up, Referral Ask, Catering | Domain verification | Hours |
| 3 | Twilio voice number with conditional call forwarding | Callback (the missed-call event) | Paid number, about $1.15 a month. No texting registration needed for voice | None |
| 4 | Twilio texting, inbound replies and STOP | Callback, Show-up Keeper, Closer, Keeper, Review Asker, Reactivator | Paid account plus A2P 10DLC registration. Sole proprietor only without an EIN; otherwise Low Volume Standard or the ISV setup | Twilio estimates about 4 days. Azure's general figures are 2 to 3 business days for a brand, then 3 to 5 for a campaign |
| 5 | Stripe invoice webhooks | Payment Nudger | A Stripe Connect app | Not researched |
| 6 | Google Calendar read, or Calendly webhooks | Show-up Keeper | Google sensitive-scope verification for Calendar | Not researched |
| 7 | Square sandbox, then real sellers | Restaurants and stores: orders, catering | Free sandbox, needs a seed script. Unsettled whether a real seller needs a Marketplace listing | Unknown |
| 8 | Jobber quotes | Closer, Debrief | Not researched yet | Unknown |
| Later | Google Business Profile: reviews in, replies and posts out | Review Drafter, Post Drafter | Profile verified and 60 days old, plus an access application. Quota stays at 0 until approved | Google says within 14 days |
| Later | Meta: Instagram DMs, Lead Ads, posts | Inquiry Responder, Post Drafter | Business verification plus App Review | About 2 days to 3.5 months reported |
| Skip for now | Gmail read, Toast, Clover, QuickBooks | | `gmail.readonly` needs a yearly CASA audit. Toast's partner path takes months. Clover's wait is unknown. QuickBooks needs an assessment questionnaire | |

Gmail send is a sensitive scope that needs Google's app verification but no security audit. It can replace order 2 later, if owners want mail to come from their own Gmail.

## Rules that touch sending

- **Texts:**
  - Get prior express consent for informational texts and written consent for promotional ones.
  - The first text carries the STOP line.
  - Honor a revoked consent within 10 business days.
  - Maryland bars solicitations from 8 p.m. to 8 a.m., and the same subject at most 3 times in 24 hours.
  - Tobacco and vape texts are banned outright, and a rejected campaign can't be resubmitted. (CL, "TCPA, FCC rules and A2P 10DLC")
- **Calls:** Maryland requires every party's consent to record a call, so Anchored never records or transcribes one. (CL, "Maryland call recording")
- **Reviews:** Google allows automated replies only with the owner's "prior specific and express consent." Review content is kept at most 30 days. The FTC rule bans incentives tied to ratings. (CL, "Google Business Profile" and "FTC fake review rule")
- **Allergies:** Unchanged. Anchored never drafts an allergy reply, and the thread stays locked until the owner writes it.
- **Not researched yet:** CAN-SPAM for marketing email, and state AI disclosure laws. CL says to disclose by default.

## Start this week, because others set the wait

- Open a paid Twilio account and start A2P 10DLC registration.
- Apply for Google Business Profile API access.
- Start Meta business verification.
- Set up the Google OAuth consent screen if Calendar or Gmail send is in scope.

## 16-week outline

| Weeks | Work |
| --- | --- |
| 1 to 2 | Foundation: contacts and consent, connections, the outbox queue and dispatcher, the shared ingest path |
| 3 to 4 | Inbound forwarding address and outbound email |
| 5 to 7 | Twilio voice for missed calls, then texting once A2P clears |
| 8 to 9 | Contact import with consent sources, STOP handling, the promotional and informational tag |
| 10 to 11 | Stripe invoices and calendar bookings |
| 12 to 13 | Square, and Jobber after research |
| 14 to 16 | Google Business Profile and Meta if approved; otherwise better paste flows for reviews and DMs |

## Decisions for the team

1. **Who is the texting sender?** One Anchored ISV registration with a profile per business, or each owner's own Twilio account. This changes A2P cost and paperwork, and the team hasn't researched the ISV path.
2. **Email from Anchored's domain or the owner's Gmail?** The transactional route ships in days. Gmail needs Google's app verification.
3. **Does a missed call count as an inquiry under Maryland's single-reply exemption?** CL marks this unsettled. Get a lawyer's answer before Callback texts automatically.

## For the video on Nov 8

Build none of this before the video. Show the chat request, the card in Approvals and the send-it-yourself step. Then name connectors as the next 16 weeks, with Twilio and email first.
