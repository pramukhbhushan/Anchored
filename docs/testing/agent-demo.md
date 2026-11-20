# Agent test runbook

How to walk through the agents end to end, on a local build or a deployment, and the live checks to run before you call a flow working. [agents.md](../agents.md) explains what each agent does.

Telegram is optional and off unless the server sets `TELEGRAM_BOT_TOKEN`. It has not been verified in production, so treat every Telegram step here as a check to run, not a known result. Automated tests use fake providers and do not prove that a provider delivered a message.

## Before you start

1. Pick the version you are testing and run `npm run check` on it.
2. If you test against Supabase, apply every migration in `supabase/migrations/` that the version needs. Review them first: `supabase db push` against a database with a partial migration history can fail halfway.
3. For Telegram, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` and `CRON_SECRET` on the server. Use your own test bot from BotFather. Keep tokens, secrets, private email addresses and customers' messages out of screenshots and recordings.
4. Register the webhook against the deployment you are testing and check its status:

   ```bash
   node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts set https://YOUR-DEPLOYMENT
   node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts info
   ```

   A bot has one webhook, and `set` drops pending updates. Pointing the bot at a laptop tunnel takes its updates away from any other deployment.
5. Use your own Telegram account and a business the current browser session owns. The shared example business has no Telegram inbox.
6. For a local run, build once and start on a port nobody else uses: `ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p <port>`. The in-memory store loses businesses, Telegram links and history on restart, so make the business again and open its new link.
7. A scheduler calls `GET /api/cron/dispatch` every 5 minutes and `GET /api/cron/brief` hourly, both with `Authorization: Bearer <CRON_SECRET>`. Both return 404 without it. Dispatch also checks recorded follow-ups and license dates.
8. Use harmless test facts. Do not invent prices, open times, consent or finished jobs to make a step work. When a feature is unavailable, check that the page says so.

## Walkthrough

| Step | Do | Check |
| --- | --- | --- |
| 1 | Make a clearly labeled test business through the setup chat | The profile holds what you typed. The page says whether AI is on or the rules are drafting |
| 2 | Open Workflows, pick a workflow and compare its tools | Choose a Customer workflow that Anchored drafts |
| 3 | Open Connections or Customer and expand Telegram setup | The business's own link and QR code show, with no credentials. The acknowledgment switch starts on |
| 4 | Scan the QR code, tap Start and send "Do you mow lawns on Saturdays?" | The fixed start reply and one acknowledgment arrive. The draft uses recorded facts, or asks the owner, instead of inventing Saturday hours |
| 5 | Read the Customer thread, open the draft in Approvals and approve it | The reply arrives once, and the outbox and thread show the provider's result |
| 6 | Send an allergy question, then `/stop` in a separate message | The allergy question becomes a locked card with no drafted answer. `/stop` gets the fixed reply, and the next send to that customer is refused |
| 7 | Open Internal Communications, press Run now, then open Overview | The brief counts real cards and deliveries |
| 8 | Record a follow-up and a license date, or remove your test reply from the outbox | Follow-ups become drafts, license dates become notes for the owner, and removal keeps the sent text |

## Owner controls

- **Recorded follow-ups:** `GET`, `POST` and `PUT /api/businesses/[id]/followups`. Record a real due time, contact, chosen skill, job state, source id and evidence. The server rechecks cancellation, STOP, allergy locks and touch limits before approval and dispatch. Debrief makes a note for the owner.
- **License dates:** `GET` and `PUT /api/businesses/[id]/licenses`. Save the license name, expiry date and source. Notes arrive 30 days and 7 days before, on the day, and once overdue, in Eastern dates. Marking a license handled, removing it or changing its date replaces old notes.
- **Removing a Telegram message:** `POST /api/businesses/[id]/outbox/[entry]/delete` with `{ "confirm": true }`, offered for 48 hours after sending. The server decides eligibility. The sent text and delivery history stay, and the customer may already have read it.

## Live checks

Write down the version, date, test business and result of each check. Keep secrets out of the record.

- Open the business's link with Start. The welcome arrives and the chat binds to the right business.
- Send one harmless question. One incoming message is stored, one acknowledgment is sent for the 12-hour window, and one draft waits. A replayed webhook update duplicates none of them.
- Approve the draft once. One Telegram reply arrives, and the thread and outbox both show it sent.
- Switch the acknowledgment off. The setting survives a reload, and the next test message gets no acknowledgment.
- Send an allergy question. The card is locked and has no drafted answer.
- Send `/stop`. The fixed reply arrives, and the next send to that customer is refused. Test `/start` again separately.
- Remove your own test message inside the 48 hours. The provider's result shows, and the history stays.
- Save a test follow-up and a test license date, then run dispatch or Run now. Cards are not duplicated, canceling works, customer drafts wait for approval, and license notes go to the owner only.
- Run the brief twice quickly. Only one run happens at a time, and a failed run keeps the last good brief.
- Reload the deployment and sign in again. Everything persisted. Check the server logs for store errors without logging customer text.
- Forward an email to a test Postmark inbound address. The right card appears, and no reply is sent.
- Call both cron routes without the secret and get 404, then confirm the scheduler calls them. A Run now press does not prove the schedule is installed.

## Screenshots

`docs/screenshots/1-describe.png` to `5-stack.png` show the main app flow, and `agent-license-desktop.png` and `agent-license-phone.png` show Internal Communications. All were taken from a local preview with sample data. Check every new screenshot for secrets and real customer data before you add it.
