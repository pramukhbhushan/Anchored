# Agents

Where no tool fits a job, an Anchored agent drafts the work as cards in Approvals. Nothing reaches a customer until the owner approves the card. This page explains the four agent workspaces, what each agent drafts, and what starts it.

For the layers and the send rules every agent shares, read [architecture.md](architecture.md). For the security controls, read [security.md](security.md).

## Agents, skills and workspaces

The domain defines five core agents in `CORE_AGENTS` (`lib/domain/agents.ts`): `frontdesk`, `followup`, `books`, `content` and `internal`. Each skill in `SKILLS` names the agent it belongs to. `crewDecisions` in `lib/domain/crew.ts` decides which agents a business starts with, and `assembleAgentConfigs` in `lib/domain/agent-config.ts` builds each active agent's settings. Every agent's only output is an approval card.

The app shows four workspaces, one per route token under `/app/b/<id>/workflows/`:

| Token | Name in the app | Core agents | Skills |
| --- | --- | --- | --- |
| `customer` | Customer | `frontdesk` and `followup` | callback, inquiry, showup, catering, callfollow, closer, debrief, reactivator, keeper, referral, reviewer |
| `books` | Bookkeeping | `books` | nudger, pricewatch |
| `content` | Marketing | `content` | posts, reviewdrafter |
| `internal` | Internal Communications | `internal`, always on | brief, triage, license |

`normalizeAgentId` in `components/business/agents/view-model.ts` merges `frontdesk` and `followup` into the Customer workspace for display only. The stored records keep their own agent ids. A niche agent that a business turns on gets a workspace too.

The page is `app/app/b/[id]/workflows/[workflow]/page.tsx`, and the automation pages under it are `workflows/[workflow]/[automation]/page.tsx`. A workspace opens only when its agent is active in the business's plan. Each one shows the agent's cards, its outbox and its own chat. Approvals stays the one place the owner decides.

## How a card is made

1. **Something happens.** A webhook delivers an event, such as a customer's text or a missed call, the owner types in chat, or a scheduled job finds due work. `ingestEvent` in `lib/server/ingest.ts` maps each event source to a skill through `SOURCE_SKILLS`.
2. **Code decides.** Code picks the skill, the contact and the facts. The model writes only the words, and code checks the reply before it uses it. With no AI provider set, or when a reply fails a check, the card uses a template.
3. **The owner approves.** `decideCard` in `lib/server/decide.ts` runs `checkSend` and writes the approved message to the outbox.
4. **Anchored sends.** `lib/server/dispatch.ts` runs `checkSend` again at send time, then sends through the connector. `GET /api/cron/dispatch` sends what is due.

## Customer

Customer answers new messages and follows up on work the owner recorded. A customer's text or missed call to the owner's Twilio number becomes a draft through `ingestEvent`.

- **Recorded follow-ups.** The owner records a contact, a chosen skill, a due time, the job's state, a source id and evidence through `FollowupSchedule`, which calls `GET`, `POST` and `PUT /api/businesses/[id]/followups`. `dueFollowup` in `lib/domain/followups.ts` turns a due record into a draft text to the contact's number, which needs a texting OK on file. Closer and Call Follow-up stop after 3 approved touches. Debrief makes a note for the owner, not a customer message. A timer never sends on its own.

## Bookkeeping

Bookkeeping drafts reminders for unpaid invoices and stops them once the invoice is paid. It never moves money.

- **Where invoices come from.** The owner's chat ("Maya Chen owes $450 on invoice 1042, due Oct 20"), read by `readInvoiceMessage` in `lib/domain/invoices.ts`; Stripe's `invoice.overdue` and `invoice.payment_failed` events; and the simulator.
- **Reminders.** `reminderCard` uses only the amount, the invoice number and the due date from the source. `checkReminderDraft` refuses late fees and threats. `MAX_REMINDERS` caps each invoice at 2 reminders, and a third is refused. Reminders go out by email.
- **Paid.** When an invoice is marked paid, `matchPaidInvoice` finds it and asks which invoice if the customer has more than one open. `cancelInvoiceReminders` stops the reminders still waiting, and the owner gets a note.
- **Price Watch.** It formats a simulated supplier invoice that already carries its prices. Forwarded supplier email becomes a triage card, and Anchored reads no prices from it.

## Marketing

Marketing drafts social posts from the owner's photos and drafts review replies.

- **Photo posts.** The owner sends photos in chat. `draftPhotoPost` in `lib/server/posts.ts` plans the post from the shared playbook of formats, hooks and hashtags, and the model writes captions for Instagram, Facebook and LinkedIn without seeing the photos. A caption that fails a check is replaced with one from the rules. The result is a "Copy post" card the owner posts themselves.
- **Limits.** 10 posts a day, and 10 photos a post at 5 MB each, in JPEG, PNG or WebP (`lib/domain/photos.ts`). Photos live in the private `post-photos` storage bucket.
- **Reviews.** A `review` event drafts a reply through Review Drafter, or through Customer's Review Asker for a business that asks for reviews.

## Internal Communications

Internal Communications runs for every business. It writes the daily brief and watches license dates. Inbox Triage, which sorted forwarded email, has no way to receive email: the forwarding address ran on a Postmark account the original team held, and it was removed.

- **Daily brief.** `runBrief` in `lib/server/brief.ts` writes the brief, and `briefSnapshot` in `lib/domain/brief.ts` computes every number in code. `GET /api/cron/brief` runs hourly and writes at most one brief per business a day, from 7 a.m. Eastern. The Run now button (`BriefRun`) runs it on demand, and Overview shows the latest one. A failed run keeps the last good brief.
- **License dates.** The owner records each license's expiry date, source and status through `LicenseDates`, which calls `GET` and `PUT /api/businesses/[id]/licenses`. The dates live in `ProfileDetails.licenses`, in the versioned profile, and the model never fills them in. `renewalNotice` in `lib/domain/renewals.ts` leaves a note for the owner 30 days and 7 days before expiry, on the day, and once overdue, using Eastern dates across clock changes. Marking a license handled, removing it or changing its date replaces the old notes. Anchored never renews or files anything.

## Recorded work on a schedule

`lib/server/agent-work.ts` turns recorded follow-ups and license dates into cards. It runs when the owner saves a record, during `GET /api/cron/dispatch`, and before Run now counts the brief. It needs no cron entry of its own. Each card has a stable key, so repeated or overlapping runs draft nothing twice. Canceling a follow-up invalidates its pending cards, and both approval and dispatch check the saved record again.

Follow-up records live in the `customer_followups` table, filtered by session and business, cleared by reset and deleted with the business. Each scheduled run reads at most 200 businesses (`runDueAgentWork`, `runDueBriefs`), so a larger deployment needs paging first.

## Agent chats

Each workspace has its own chat. The chat route accepts an optional `agent` token, and the server checks it against the business's active agents and limits drafts to their chosen skills. Each workspace keeps its own history in the business's thread, under the id `<business id>:agent:<agent id>`. General chat keeps its own thread.

Chat answers run on the business's own AI key through `getBusinessLlm` and have no tools, so the model cannot change data or send anything. Code still reads requests, records business changes and prepares cards. When the business has no AI key or a call fails, the chat says so. Visitors can chat with the example business, but their messages cannot change its facts, create cards or send anything.

## Not built

These appear in old plans and do not exist:

- Handoffs between agents. A billing question or a supplier invoice becomes a note for the owner.
- Reading supplier prices from forwarded email, and invoice CSV or Excel upload.
- A Stripe `invoice.paid` reader. Payment arrives through chat or the simulator.
- A review request after a paid invoice. Payment alone does not prove the job is done.
- A weekly posts schedule.

## Screenshots

These show a local preview with sample data and the in-memory store.

![Internal Communications with a recorded license and its renewal card](screenshots/agent-license-desktop.png)

[Phone view of the same controls](screenshots/agent-license-phone.png)
