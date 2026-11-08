# Agent demo runbook

Updated November 8, 2026. This is a recording script and verification checklist, not evidence of a recorded video. Eric still needs to record and share the 10-minute video.

## What can be claimed

| Area | Evidence and current limits |
| --- | --- |
| Main frontend | Workflow map, setup chat, compare/adopt flow, automation detail pages and the existing shell are retained alongside agent workspaces |
| Telegram path | Implemented secret-checked ingress, update claims, business binding, customer threads, chosen-skill drafts, fixed acknowledgment, owner approval and centralized dispatch. The earlier handoff reports a real local phone test of start, message, acknowledgment and approved reply |
| Production Telegram and Supabase | Not verified by that local test. Confirm the deployed version, matching webhook secret, applied migrations and real persisted rows before claiming a live production flow |
| Internal Communications | Authenticated forwarded-email triage and persisted deterministic brief are implemented. Triage is covered by automated tests; real Postmark webhook delivery remains to be tested |
| Follow-ups, renewals and deletion | Implemented with authorized owner controls and automated coverage. Customer timers use recorded dates, states, source ids and evidence; Debrief and license warnings are owner-only. Deletion uses server-provided eligibility and retains the sent-message audit. The two new migrations are not applied to live Supabase, and no live result for these features is claimed |
| Bookkeeping and Marketing | Main's existing invoice and payment behavior is retained. Dedicated feeds, handoff helpers, canonical identities still depend on Pramukh's contracts |
| Model use | With AI settings absent, replies use checked templates. With a configured provider and remaining budget, the model can draft grounded wording. The brief and email triage currently use code and rules. State the actual mode during the recording |
| Automated verification | Node 26 `npm run check` passed on the resumed combined tree: type checking, 1,567 tests across 131 files and the production build. Local browser checks verified onboarding, Customer's unavailable states, license entry, saved facts, one renewal card, brief refresh and ineligible Telegram deletion controls staying hidden. The completed UI pass covered 1440/1024/768/390px; the resumed pass rechecked Customer, Internal, Workflows, Approvals, Stack and Tools at 390px without overflow or page errors |
| Video | Script only. No video has been recorded or linked by this implementation |

## Before recording

1. Choose the exact deployed or local version and record its commit or working-tree state. Run Node 26 `npm run check` on the same combined code. A passing build does not prove a provider delivered a message.
2. Ask Pramukh to confirm the receiving database has every migration required by that version. The handoff reports the original Telegram and brief migrations applied. Pramukh must manually review and apply `20261108000700_telegram_deletion.sql`, then `20261108000800_customer_followups.sql`, before this version deploys. Neither new migration was applied to live Supabase by this implementation. Do not run `supabase db push` against the existing team database with its incomplete migration history.
3. Confirm `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME=AnchorMesageBot`, `TELEGRAM_WEBHOOK_SECRET` and `CRON_SECRET` are set on the receiving server. Compare the secret privately with the registration environment. Never show tokens, secret values, private email addresses or other customers' messages in the recording.
4. With the shared bot operator's approval, register the intended HTTPS deployment and inspect its status:

   ```bash
   node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts set https://YOUR-DEPLOYMENT
   node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts info
   ```

   Registration replaces the bot's only webhook and drops pending updates. Do not redirect the shared production bot to a tunnel merely to test UI. Confirm a new update reaches the intended app.
5. Use only Eric's test Telegram account and a business owned by the current session. Open the application in the same browser that owns that business. The shared example business has no live Telegram inbox.
6. If local, use a port no teammate holds, build once, then start with `ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p <port>`. Do not rebuild the files beneath the running production server. An in-memory restart removes businesses, bindings and history; recreate the business and open its new link.
7. Have Pramukh confirm the dispatch schedule every 5 minutes and brief schedule hourly. Both require `Authorization: Bearer <CRON_SECRET>` and reject missing or incorrect authorization with 404. The dispatch route now checks due recorded follow-ups and license warnings as well as sending queued messages. Brief Run now checks recorded work before counting. No new cron route or schedule is required.
8. Prepare a harmless recorded business fact and test message. Do not invent prices, availability, consent or completed jobs to make a scene work. If a capability is unavailable, show the unavailable state and explain the dependency.

## Implemented owner controls

Customer's recorded follow-ups use `GET`, `POST` and `PUT /api/businesses/[id]/followups`. Record an actual due time, contact, chosen skill, relevant job state, source id and evidence. The server deduplicates cards and rechecks cancellation, STOP, allergy locks and touch limits before approval and dispatch. Customer messages use Telegram; Debrief creates an owner-only flag. A timer is not permission to send automatically.

Internal's license dates use `GET` and `PUT /api/businesses/[id]/licenses`. Save the actual license name, expiry date and source. The versioned profile stores the structured list. Notices use Eastern civil dates, including DST, at 30 days, 7 days, expiry and overdue. Marking a license handled, removing it or changing its date supersedes stale pending notices. License Clerk never renews, files or contacts anyone.

Eligible outbox messages offer removal through `POST /api/businesses/[id]/outbox/[entry]/delete` with `{ "confirm": true }`. Only the server decides eligibility from the actual sent message and the 48-hour window. Confirmed removal retains the body and delivery audit. Someone may already have read it.

## Ten-minute recording script

| Time | Screen and action | What to explain |
| --- | --- | --- |
| 0:00 to 0:45 | Open Anchored and introduce a small-business example | The owner finds tools first. Where no tool fits, Anchored drafts work for approval. Fixed Telegram acknowledgments and command confirmations are the stated exceptions |
| 0:45 to 2:00 | Create Greenfield Lawn, or another clearly labeled test business, through the current setup chat | Show the current frontend and the recorded facts. State whether AI is configured or the checked rules/templates are running |
| 2:00 to 3:00 | Open Workflows, the map, a workflow choice and a tool comparison | Existing navigation, workflow planning and compare/adopt behavior are retained. Choose a Customer workflow that Anchored drafts |
| 3:00 to 4:00 | Open Connections or Customer and expand Telegram setup | Show the real business link and QR. Explain the fixed acknowledgment starts on and can be turned off. Do not display credentials |
| 4:00 to 5:30 | Scan the QR on Eric's phone, tap Start and send "Do you mow lawns on Saturdays?" | Show the fixed start confirmation and acknowledgment. The draft must use recorded facts or ask the owner for missing facts, rather than invent Saturday availability |
| 5:30 to 6:30 | Read the Customer thread, open the waiting draft in Approvals, approve it and show Eric's phone | The owner decides the actual reply. The outbox and thread report the real provider outcome. If the live test fails, show that result and do not claim delivery |
| 6:30 to 7:15 | Send an allergy question, inspect the lock, then test `/stop` with a separate harmless message | Anchored does not draft an allergy answer. STOP blocks future messages for the bound business. A fixed stop confirmation is a protocol notice. Restore with the business's `/start` link only when intentionally testing restart |
| 7:15 to 8:15 | Open Internal Communications, press Run now, then open Overview | The same persisted brief reports actual cards, deliveries and safety changes. No invented dollar totals or sample results count as real work |
| 8:15 to 9:15 | If deployed with both new migrations and live checks completed, show a recorded follow-up, an evidenced license date, or removal of Eric's test reply. Otherwise show the local controls and state their live-verification limits | Follow-ups create drafts, licenses create owner notices, and message removal cannot undo reading. Identify automated-only or not-yet-deployed behavior as such |
| 9:15 to 10:00 | Return to the full app, show the prototype URL and state the remaining dependencies | Dedicated Bookkeeping/Marketing feeds, cross-agent handoffs, canonical identities remain Pramukh's integration work. State what was demonstrated live and what was only tested locally |

## Controlled live checks

Record the target version, date, test business and observed result for each check. Keep secrets out of the record.

- Start with the business's actual link. Confirm the welcome and correct business binding.
- Send one harmless question. Confirm one stored incoming message, one acknowledgment for the 12-hour window, and one waiting draft. Replayed webhook tests must not duplicate them.
- Approve the intended draft once. Confirm one actual Telegram reply and a sent result in both the thread and outbox.
- Switch the acknowledgment off. Confirm the saved state persists and a subsequent test message has no automatic acknowledgment. Switching it back on is an explicit owner action.
- Send an allergy question. Confirm a locked owner card and no generated allergy answer. Resolve it only through the normal owner flow.
- Send `/stop`. Confirm the fixed confirmation and that a subsequent customer send is refused. Do not use another route or tool to bypass a refusal. Test explicit restart separately.
- If deletion is verified in the target version, remove only Eric's test message inside the allowed window. Confirm the actual provider result and retained audit history. Explain that the recipient may already have read it.
- For recorded follow-ups and renewal scheduling, save genuine test facts and use the authorized dispatch scheduler or Internal Run now. Confirm dedupe, cancellation/completion, owner approval for customer drafts, and owner-only license notices.
- Run the brief twice quickly. Confirm overlap does not create two simultaneous runs and the last successful snapshot survives a failure.
- Confirm persistence after a production refresh and account session round trip. Inspect server logs for store errors without exposing customer text.
- Test forwarded-email triage with an authorized test Postmark server and Eric's own email. Confirm the card category and that no automatic response is sent. Automated fixture coverage alone does not satisfy this check.
- Confirm the scheduler calls both configured routes successfully and unauthenticated calls return 404. A manual Run now does not prove the schedule is installed.

## Screenshots and delivery

Existing `docs/screenshots/1-describe.png` through `5-stack.png` illustrate the earlier app flow; they are not evidence of current agent delivery. Capture new screenshots from the verified final target for Customer history, Telegram setup, Approvals/outbox, Internal brief and a phone-sized view. Use only test data and review each image for secrets before adding it. No new screenshot file is claimed by this runbook.

After recording, Eric should add the actual video URL, verified prototype URL, target version, date and a short live-versus-simulated note. Until those artifacts exist, keep their status as pending.

## Current local screenshots

Captured from the November 8 in-memory preview with invented demonstration facts. No customer data or credentials appear.

- [Desktop Internal Communications](screenshots/agent-license-desktop.png)
- [Phone Internal Communications](screenshots/agent-license-phone.png)

These images show the owner controls, an evidenced expiry date, the generated renewal card and brief. They are not screenshots of a deployed Supabase test or a recorded video.
