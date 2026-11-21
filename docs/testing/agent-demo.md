# Agent test runbook

How to walk through the agents end to end, on a local build or a deployment, and the live checks to run before you call a flow working. [agents.md](../agents.md) explains what each agent does.

Automated tests use fake providers and do not prove that a provider delivered a message.

## Before you start

1. Pick the version you are testing and run `npm run check` on it.
2. If you test against Supabase, apply every migration in `supabase/migrations/` that the version needs. Review them first: `supabase db push` against a database with a partial migration history can fail halfway.
3. Set `CRON_SECRET` on the server. To test real sends, connect your own Twilio number on Connections and add yourself as a customer with a texting OK. Keep keys, secrets, private email addresses and customers' messages out of screenshots and recordings.
4. Use a business the current browser session owns. The shared example business can't connect services.
5. For a local run, build once and start on a port nobody else uses: `ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p <port>`. The in-memory store loses businesses and history on restart, so make the business again.
6. A scheduler calls `GET /api/cron/dispatch` every 5 minutes and `GET /api/cron/brief` hourly, both with `Authorization: Bearer <CRON_SECRET>`. Both return 404 without it. Dispatch also checks recorded follow-ups and license dates.
7. Use harmless test facts. Do not invent prices, open times, consent or finished jobs to make a step work. When a feature is unavailable, check that the page says so.

## Walkthrough

| Step | Do | Check |
| --- | --- | --- |
| 1 | Make a clearly labeled test business through the setup chat | The profile holds what you typed. The page says whether AI is on or the rules are drafting |
| 2 | Open Workflows, pick a workflow and compare its tools | Choose a Customer workflow that Anchored drafts |
| 3 | Open Connections, connect your Twilio number and add yourself as a customer with a texting OK | The number shows with the webhook URLs to paste into Twilio, and no credentials |
| 4 | Text the Twilio number "Do you mow lawns on Saturdays?" | One draft waits. It uses recorded facts, or asks the owner, instead of inventing Saturday hours |
| 5 | Open the draft in Approvals and approve it | The text arrives once, and the outbox shows the provider's result |
| 6 | Text STOP | The next send to that number is refused |
| 7 | Open Internal Communications, press Run now, then open Overview | The brief counts real cards and deliveries |
| 8 | Record a follow-up and a license date | Follow-ups become drafts, and license dates become notes for the owner |

## Owner controls

- **Recorded follow-ups:** `GET`, `POST` and `PUT /api/businesses/[id]/followups`. Record a real due time, contact, chosen skill, job state, source id and evidence. The server rechecks cancellation, STOP, allergy locks and touch limits before approval and dispatch. Debrief makes a note for the owner.
- **License dates:** `GET` and `PUT /api/businesses/[id]/licenses`. Save the license name, expiry date and source. Notes arrive 30 days and 7 days before, on the day, and once overdue, in Eastern dates. Marking a license handled, removing it or changing its date replaces old notes.

## Live checks

Write down the version, date, test business and result of each check. Keep secrets out of the record.

- Text one harmless question to the Twilio number. One draft waits.
- Approve the draft once. One text arrives, and the outbox shows it sent.
- Text STOP. The next send to that number is refused. Text START to opt back in.
- Save a test follow-up and a test license date, then run dispatch or Run now. Cards are not duplicated, canceling works, customer drafts wait for approval, and license notes go to the owner only.
- Run the brief twice quickly. Only one run happens at a time, and a failed run keeps the last good brief.
- Reload the deployment and sign in again. Everything persisted. Check the server logs for store errors without logging customer text.
- Call both cron routes without the secret and get 404, then confirm the scheduler calls them. A Run now press does not prove the schedule is installed.

## Screenshots

`docs/screenshots/1-describe.png` to `5-stack.png` show the main app flow, and `agent-license-desktop.png` and `agent-license-phone.png` show Internal Communications. All were taken from a local preview with sample data. Check every new screenshot for secrets and real customer data before you add it.
