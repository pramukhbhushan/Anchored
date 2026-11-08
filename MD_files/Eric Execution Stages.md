# Eric's execution stages

Companion to `Eric Agent System Implementation Plan.md`, which still sets the rules and finish lines. That plan says what must be true; this file says what gets built, in what order, with what interfaces. November 8, 2026.

Each stage is one major piece and ends at a checkpoint you test yourself before anything is pushed: its own commit on `feat/agent-execution`, its own test command, and a short manual check. Nothing goes to `origin` until you say so.

## Branches

- `feat/agent-execution` holds stages 1 to 3, the server work. It sits on `origin/main` (`6b4a7f8`), so each stage can land on its own. Its working folder is `.claude/worktrees/eric-agent-dashboard`.
- `feat/agent-dashboard` stays at the UI checkpoint `987f690` until stage 4.

## Progress and open items

**Update, November 8:** Pramukh applied both migrations to live Supabase (issue #48). The acknowledgment now starts on and Telegram replies send at any hour, both after the phone test. What is left, and the traps, are in `Eric Remaining Work Handoff.md`.

Commits on `feat/agent-execution`, none pushed: `caa6390` (stage 1), then `e9f7033`, `20f25f3` and `4f54274` (stage 2), then `c2abca9` (stage 3).

Stage 4 is on `feat/agent-dashboard-v2`, branched from stage 3, so it carries all the server work. `10d0e70` replays the dashboard checkpoint without the workflow map; `4a95891` wires the pages to the real APIs and adds the link's QR code (`qrcode` 1.5.4, drawn on the server as SVG, checked to decode to the link). The layout was checked in headless Chrome at 1440, 1024, 768 and 390px: no sideways scroll, no console errors. Land `feat/agent-execution` first if the two go as separate PRs.

**Stage 4 work left:**
- Agent Ask, which waits on Pramukh's validated `agent` field in the business chat.
- Bookkeeping and Marketing views, which wait on his feeds.
- Deleting a Telegram message from the outbox, which waits on the server side (a stage 2 item).
- The example email card still says "Front Desk". It comes from `CORE_AGENTS` in `lib/domain/agents.ts`, which Pramukh's groundwork renames.

**Stage 2 work left for later.** None of it is needed for the demo flow:
- Deleting sent Telegram messages within 48 hours.
- Follow-up timers for Callback, Closer, Call Follow-up, Reactivator, Keeper and Referral Ask.
- Review Asker on Pramukh's paid-invoice event, once that event exists.
- Swapping the billing owner note for `createHandoffCard`, once his groundwork lands.

**Before the demo, with Pramukh:**
- **Database.** Apply `20261108000300_telegram_threads.sql` and `20261108000600_internal_briefs.sql` to the live Supabase before the new code deploys. Supabase has no record of the earlier migrations, since they were run by hand, so `supabase db push --remote` would try to rerun all of them. Either he marks 00000 to 00200 as applied (`supabase migration repair --status applied ... --remote`) and then pushes, or he applies 00300 the way he applied the others. The CLI (version 3) needs `--remote` on every command.
- **Cron.** Two `vercel.json` entries (his file), plus `CRON_SECRET` in Vercel:
  - `/api/cron/dispatch` every few minutes, so replies held overnight go out in the morning.
  - `/api/cron/brief` hourly. It writes each business's brief once a day from 7 a.m. Eastern; the other hourly calls do nothing.

**Stage 3 work left for later:**
- License Clerk renewal reminders.
- Forwarded billing and supplier emails go to the owner as cards for now. They switch to Pramukh's `createHandoffCard` and `receiveSupplierInvoice` once those land.
- The brief doesn't yet include Pramukh's Bookkeeping and Marketing feeds.
- Model suggestions for triage. Triage uses the rules alone, which the plan allowed.
- **Telegram.** Set the three settings in Vercel (Part B of the setup steps), then run `scripts/telegram-webhook.ts set <app-url>` after the deploy.

## Facts found while writing this

- `origin/main` includes `fe0ef7c`, which **reverts PR #45**: the workflow map, the `[automation]` pages, the sidebar automations and the app theme. `docs/design/backlog/README.md` puts them on hold until the owner picks them. **Decision (November 8): follow the revert.** The server stages never touched that code. Stage 4 rebuilds the dashboard on the reverted tree.
- The V2 design and `pramukh_tasks.md` on main give **Eric `20261108000300_telegram_threads.sql`**, and put Pramukh's groundwork inside `20261108000400_bookkeeping.sql`, with marketing reviews in `00500`. Eric's later Internal schema takes `20261108000600`.
- Pramukh's file also fixes the groundwork shapes: `CoreAgentId` becomes `customer | books | content | internal`, `canonicalAgent(id)` maps `frontdesk`/`followup` to `customer`, `ConversationOwner` becomes `customer | books | closed`, and `createHandoffCard(session, business, { toSkill, parentKey, contactId, facts })` returns a key or `null`.
- None of that groundwork exists yet (`CoreAgentId` still has `frontdesk`). Stages 2 and 3 do not wait for it: Customer cards keep their current agent ids (the UI already shows them as Customer), and billing handoffs become an owner note until `createHandoffCard` lands.
- Twilio texting already has contacts, consent, STOP and a quiet-hours queue. Telegram follows the same pattern for contacts, consent and STOP, but not quiet hours.
- The local Node is 24. `.nvmrc` says 26, so tests also run under Node 26 (`npx -y node@26 node_modules/vitest/vitest.mjs run`).

## Decisions settled here

These were left open in the plan. Each is a default you can overrule; the code follows it until you do.

| Question | Decision |
| --- | --- |
| Where the business's Telegram hook id lives | A `telegram_hook_id` column on `businesses`, created the first time it's needed, so existing businesses backfill themselves. Never on the shared example |
| How a chat finds its business | A `telegram_chats` table keyed by chat id, holding the latest `/start` binding and the owning session. A deployment-wide lookup, like `findConnection`, documented as such |
| The `/start` and `/stop` confirmations | A fixed **protocol notice** written by a new function in `lib/server/decide.ts` (still the only outbox writer), marked `rule: "protocol"`, then sent at once by `dispatchEntry` (still the only sender). Fixed text, no model. STOP and the allergy lock still apply. Quiet hours do not, since the customer just typed the command |
| STOP scope | `/stop` stops that customer for the business the chat is bound to. Blocking the bot stops them bot-wide (`blocked_at` on the chat binding), which dispatch checks on every Telegram send. A new `/start <hook>` is an explicit restart: it re-consents that business and clears `blocked_at` |
| Queued work from an older binding | Dispatch sends a Telegram message only if the chat is still bound to the entry's business. Otherwise it fails with "This customer switched to another business's link." |
| A new message while a reply is pending | The existing `supersedePendingCards` replaces the older pending draft for that contact. Approved and queued replies are rechecked at dispatch, not recalled |
| Webhook processing | Synchronous. Claim `update_id` (`claimed`, `done`, `failed`), process, then answer 200. On error answer 500 so Telegram retries; a claim older than two minutes may be retaken. No detached promises |
| Acknowledgment default | On for every new business (decided November 8, after the phone test: silence after a customer's message felt broken). It is fixed text, so the owner can turn it off but never needs to approve it first. The design doc said rules start off; tell Pramukh |
| Acknowledgment frequency | At most once per contact per 12 hours, keyed `ack:{contactId}:{windowStart}` and enforced by a unique `rule_key` on the outbox. Turning the rule off fails every queued acknowledgment with a note, and dispatch rechecks that the rule is still on |
| Quiet hours | Texts only. Telegram replies and the acknowledgment go out the moment they're approved, any hour (decided November 8: the customer opened the chat, and holding replies looked broken). No solicitation rule covers a chat reply. Email sends at any hour too. The opt-out line stays SMS only |
| Provider failures | Network errors and Telegram 5xx or 429: requeue in 5 minutes, at most 3 tries. 4xx: failed for good, and a 403 "blocked" also marks the chat blocked. A timeout after the request left: failed with "may have sent", never retried blindly |
| Brief window | Since the last successful run, capped at 7 days, in the business's local day. Cron runs hourly and runs each business once per local day after 7 a.m. |
| Renewal facts | A structured `licenses` list on the profile (name, expiry date, where the date came from). No guessed dates |
| QR code | One small, widely used dependency (`qrcode`), added in stage 4 with you approving the `package.json` change |

## Stage 1: shared foundation and Telegram transport (done, uncommitted)

Everything later stages stand on, with no customer-visible behavior yet.

1. **Migration `20261108000300_telegram_threads.sql`**:
   - `contacts`: `telegram_chat_id`, `telegram_name` and a `messaged-first` consent source.
   - `businesses`: `telegram_hook_id`.
   - `outbox`: a `telegram` channel, `rule` and `rule_key`, and a card is no longer required.
   - New tables: `thread_messages`, `telegram_chats`, `telegram_updates` with the `claim_telegram_update` function, and `standing_rules`.
   - Row-level security on every new table, and the purge extended to cover them.
2. **Domain**:
   - New `lib/domain/threads.ts` and `lib/domain/rules.ts`.
   - `telegram` added to `Channel` and to the outbox channel.
   - Telegram fields on `Contact`, and `contactByTelegramChat`.
3. **Store**:
   - 11 methods, in both backends, all cleared by `reset`.
   - The five deployment-wide ones are documented in `AGENTS.md`, `docs/architecture.md` and `docs/security.md`.
4. **Connector `lib/connectors/telegram.ts`**: update reading, secret check, plain-text send with https-only buttons, delete, and block detection.

```ts
telegramHook(session, businessId, candidate): Promise<string>           // saves candidate on first call
findTelegramHook(hookId): Promise<{ session; businessId } | null>       // deployment-wide
findTelegramChat(chatId): Promise<TelegramChat | null>                  // deployment-wide
bindTelegramChat(session, chat: { chatId; businessId; contactId; boundAt }): Promise<TelegramChat>
setTelegramChatBlocked(chatId, at: string | null): Promise<void>        // deployment-wide
claimTelegramUpdate(updateId, now, retakeAfterMs): Promise<boolean>     // deployment-wide
finishTelegramUpdate(updateId, status: "done" | "failed"): Promise<void> // deployment-wide
addThreadMessage(session, message: NewThreadMessage): Promise<ThreadMessage>
listThreadMessages(session, businessId, contactId, limit): Promise<ThreadMessage[]> // oldest first
getStandingRules(session, businessId): Promise<StandingRuleState[]>
setStandingRule(session, businessId, rule, enabled, at): Promise<StandingRuleState>
```

**Test it:**
- `npx vitest run lib/connectors/telegram lib/store lib/domain/rules`.
- `npm run check`: 1,119 tests on main's base, plus the production build.
- The migration check runs every migration on an embedded Postgres and tries each new constraint: `node <scratchpad>/pg/run.mjs supabase/migrations`.

## Stage 2: Customer agent

Ships the demo path first, then the rest. Each item is a commit.

1. **P0, Telegram in**:
   - `app/api/hooks/telegram/route.ts` checks the secret header before anything else, claims the update and calls `lib/server/telegram-hooks.ts`.
   - `/start <hook>` binds the chat, saves the contact with `messaged-first` consent and queues the protocol confirmation.
   - `/stop` and blocked updates record STOP first.
   - A text is stored on the thread and passed to `ingestEvent` with a new `telegram` source.
   - Per-chat and per-business limits apply before any model call.
2. **P0, the reply**:
   - `lib/server/customer-routing.ts` picks Closer, Show-up Keeper, Catering or Inquiry from the thread's recorded state, limited to the skills the business chose.
   - `lib/server/customer-reply.ts` drafts from the profile and the last 10 thread messages, with the customer's words marked as data, through `getBudgetedLlm`. It rejects unsupported prices, times, links and numbers and falls back to the template.
   - An allergy question becomes a locked card, as today.
3. **P0, out**:
   - `deliveryFor` and `checkSend` handle `telegram`.
   - The dispatcher sends through the connector, checks the binding, consent, STOP and blocked state again, records the provider id and writes the outbound thread message.
4. **P1**:
   - The acknowledgment rule: rules route, centralized authorization in `decide.ts`, frequency key and revocation.
   - A billing question becomes an owner note now, and switches to `createHandoffCard` once Pramukh's groundwork lands.
5. **P1**: customer reads for the dashboard: contacts with their state, ordered thread messages with linked card and delivery status, Telegram link or the reason it's unavailable.
6. **P2**:
   - Message deletion within 48 hours.
   - Timers for the follow-up skills, with dedupe.
   - Review Asker on Pramukh's paid event.
   - `scripts/telegram-webhook.ts`.

**Test it:**
- `npx vitest run lib/server lib/connectors app/api/hooks`.
- Run the app on port 3101 and POST sample Telegram updates with `curl` and the secret header. Check the thread, the card in Approvals, and that approving it queues a Telegram row.
- With a real bot token, run the webhook script against a tunnel and repeat from your phone. Only you or a test account receives messages.

## Stage 3: Internal Communications

1. **P1, triage**:
   - Keep the Postmark secret check.
   - Dedupe by provider message id.
   - Code sorts each email into customer, billing or supplier, review, or unknown. The model may only suggest from that list.
   - A customer email becomes a one-off Customer card. Supplier mail goes to `receiveSupplierInvoice` and billing to `createHandoffCard`, each an owner note until Pramukh's helpers land. Reviews go to Marketing through the same helper. Anything else becomes an owner note. No reply is ever sent.
2. **P1, brief**:
   - Extend `lib/domain/brief.ts` with a snapshot built in code: waiting cards ranked by stake with samples excluded, outbox results since the last run, STOP changes, flags, and events with no card.
   - Migration `20261108000600_internal_runs.sql` adds brief runs with a watermark.
   - Run now: `POST /api/businesses/[id]/brief`.
   - Cron: `GET /api/cron/brief`, with Pramukh adding the schedule.
   - The model may only reword; the fallback is deterministic text.
3. **P2, License Clerk**: the `licenses` profile field, warning windows, one reminder per license per window, and time-zone and DST tests.

**Test it:**
- `npx vitest run lib/server/triage lib/server/brief lib/domain/brief`.
- POST a forwarded email to the local hook with the key, and see the right card.
- Press Run now twice quickly and see one run.

## Stage 4: dashboard

1. Start a dashboard branch from current main and replay `987f690` without the workflow map.
   - **Keep:** the agent pages at `workflows/[workflow]/page.tsx`, the agent components under `components/business/agents/` and `components/connections/`, the Ask changes in `ChatWindow`, the approvals changes, the Overview rows, and the agent links in the sidebar and the command palette.
   - **Drop:** the sidebar automation list, the `[automation]` pages and anything that imports `automations.ts` or `WorkflowMap.tsx`.
   - **Rework by hand:** the conflicts in `components/routes.ts`, `Sidebar.tsx`, `location.ts` and `shell-data.ts`.
   - Tell Pramukh the agent pages live under Workflows without the map.
2. Wire the prepared components to the real reads and routes from stages 2 and 3:
   - `CustomerThreads` to the thread read.
   - `TelegramSetup` to the link read, plus a real QR.
   - `AcknowledgmentRule` to the rules route.
   - `BriefRunButton` and the Overview rows to the brief snapshot.
   - Agent Ask, once Pramukh's validated `agent` field exists.
3. Approvals and outbox:
   - Telegram labels.
   - "Sent under your acknowledgment rule" for rule-sent rows.
   - The deletion action, shown only when the server says it's allowed.
   - Copy for the rule exception.
4. Bookkeeping and Marketing views read Pramukh's feeds when they exist, and show truthful unavailable states until then.

**Test it:**
- The component tests.
- `npm run build` and `ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p 3101`.
- Browser checks at 1440, 1024, 768 and 390px, with no sideways scroll.

## Stage 5: integration, demo and landing

1. Merge Pramukh's groundwork and helpers. Swap the owner-note stand-ins for `createHandoffCard` and `receiveSupplierInvoice`, and map stored `frontdesk`/`followup` ids through `canonicalAgent`.
2. The real-phone flow:
   - Guest business, open the link, send a message, see the thread and draft.
   - Approve, and get the reply in Telegram.
   - `/stop`, and see the next send blocked.
   - Then the allergy lock, a paid-invoice cancellation, a Marketing copy and a brief refresh.
3. README, demo walkthrough and video.
4. Fetch, merge `origin/main`, run `npm run check` under Node 26, and open the PR through `land-a-pr` only when you say so.
