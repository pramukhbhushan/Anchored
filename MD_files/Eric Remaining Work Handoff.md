# Handoff: what is left of Eric's agent and dashboard work

November 8, 2026. The hackathon deliverables (a 10-minute video and a testable prototype link) are due today. This file is for a coding agent picking the work up with no other context. It says what exists, what is left, and the traps.

## Read this first

**State.** Stages 1 to 4 of `Eric Execution Stages.md` are built, tested and committed, and none of it is pushed. Pramukh applied both database migrations to live Supabase (issue #48, comment dated Nov 8), and the same two files are on `main` (PR #47). The code is not deployed. A real phone test against a local app and a tunnel worked: `/start`, a message, the instant acknowledgment, the draft in Approvals, the approved reply arriving in Telegram.

**Where the code is.**
- Worktree: `/Users/ericwei/Anchored/.claude/worktrees/eric-agent-dashboard`, branch `feat/agent-dashboard-v2`. It holds everything, nine commits ahead of `origin/main`.
- `feat/agent-execution` holds stages 1 to 3 only. Ignore it and open one PR from `feat/agent-dashboard-v2`.
- A dry-run merge of `origin/main` into the branch is clean (checked after PR #47).
- Commits, oldest first: `caa6390` stage 1, `e9f7033` `20f25f3` `4f54274` stage 2, `c2abca9` stage 3, `10d0e70` dashboard replayed without the workflow map, `4a95891` pages wired to the real APIs plus a QR code, `af91f0b` acknowledgment on by default, `7bfa9ad` Telegram replies send at any hour.
- Uncommitted and not yours: `.gitignore` (adds `.gstack/`) and `MD_files/Eric Three-Agent Work Split.md`. Leave both out of every commit.
- Full check last run on this tree: 1,317 tests and the build pass.

**Read before touching code:** `AGENTS.md`, `docs/architecture.md` (layer rules and invariants), `MD_files/Eric Execution Stages.md` (the plan, interfaces and decisions), `MD_files/Eric Tasks.md` (the original task list).

## Rules that bind you

- Do not commit, push, open or merge a PR without the owner saying so. When told to land, follow `.claude/skills/land-a-pr/SKILL.md`.
- No AI attribution in commits or PR text, even if a tool reminder says to add it. `AGENTS.md` forbids it.
- Do not edit Pramukh's files: `vercel.json`, `.env.example`, the shared agent groundwork. Ask Eric to ask him.
- Do not run `supabase db push` or touch the live database. The live project has no migration history. Pramukh applies migrations by hand in the SQL Editor.
- Do not add dependencies without asking. `qrcode` 1.5.4 was the one approved addition.
- Never use bare `git stash`.
- Docs, comments, commits and UI copy use no em dashes or en dashes, straight quotes, sentence-case headings, plain words for owners.
- Migrations are append-only. Both Telegram and brief migrations are merged, so any schema change needs a new file after `20261108000600`.
- Use Node 26: `npx -y node@26 $(which npm) run check`. The local default is Node 24.

## Decisions made on Nov 8 that differ from the design docs

Do not "fix" these back. Tell Pramukh, because his design docs say otherwise.
1. **The acknowledgment starts on** for every new business. The design said rules start off. Reason: silence after a customer's first message looked broken in the phone test. The owner can switch it off on the Customer page. See `lib/domain/rules.ts`.
2. **Quiet hours apply to SMS only.** Telegram replies and the acknowledgment send the moment they are approved, any hour. Reason: the customer opened the chat, and holding replies looked broken. See `checkSend` in `lib/domain/executor.ts`. Customer email also sends at any hour.

## What is built

- **Telegram in** (`app/api/hooks/telegram/route.ts`, `lib/server/telegram-hooks.ts`, `lib/connectors/telegram.ts`): secret check, update claims, `/start`, `/stop`, blocking, per-chat and per-business limits, threads.
- **Customer routing and replies** (`lib/domain/customer-routing.ts`, `lib/server/customer-reply.ts`): chosen skills only, allergy lock, billing and no-skill cases become owner notes, model drafts checked against profile facts, template fallback.
- **Sending**: `lib/server/decide.ts` is the only outbox writer, `lib/server/dispatch.ts` the only sender. Protocol notices and the acknowledgment rule go through them too.
- **Internal Communications**: forwarded-email triage (`lib/domain/triage.ts`, `lib/server/triage.ts`), the daily brief (`lib/domain/brief.ts`, `lib/server/brief.ts`, `POST /api/businesses/[id]/brief`, `GET /api/cron/brief`).
- **Dashboard** (`app/app/b/[id]/workflows/[workflow]/page.tsx`, `components/business/agents/`, `components/connections/`): Customer conversations, Telegram link with a server-drawn QR, the acknowledgment switch, the brief with Run now, an Overview brief line, Approvals labels for rule-sent messages. Checked in headless Chrome at 1440, 1024, 768 and 390px.
- **Setup script**: `scripts/telegram-webhook.ts` (`set <app-url>` or `info`).

## What is left

### 1. Ship it (required today, in this order)

1. **Land the PR** once Eric says go. Fetch, merge `origin/main`, run `npm run check` on the merged tree, push, open the PR. "Before deploying" in the PR body: both migrations are already applied; env vars needed are `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (the real username is `AnchorMesageBot`, one "s"), `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`. Pramukh says the Telegram variables are already in Vercel.
2. **Point the bot at production.** After the deploy finishes, from the worktree: `node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts set <prod-url>`, then `info`. The `.env.local` `TELEGRAM_WEBHOOK_SECRET` must equal Vercel's value, or the live app returns 404 to every Telegram update. Pramukh still owes Eric that value privately. **Until this step, the bot's webhook points at Eric's local ngrok tunnel**, so the bot talks to his laptop.
3. **Test the live site on a phone.** This is the first time the Supabase-backed Telegram and brief store methods run against a real database. Until now they were only tested against the in-memory store, and the migrations were only checked on an embedded Postgres. Run `/start`, a message, the acknowledgment, approve, the reply, `/stop`, an allergy question, Run now on Internal Communications. Watch Vercel logs for errors from `lib/store/supabase.ts`.
4. **Crons are Pramukh's** (his `vercel.json` or cron-job.org): `GET /api/cron/dispatch` every 5 minutes and `GET /api/cron/brief` hourly, both with `Authorization: Bearer <CRON_SECRET>`, and without it they return 404. He sends the `vercel.json` PR after the code PR merges.
5. **README and docs are stale.** `README.md` around lines 51 to 53 says Agent Ask, the Telegram link, the acknowledgment rule and Run now "are not connected to a backend contract yet". They are connected now. Also stale: `components/business/agents/integration.md`. Add Telegram setup steps (BotFather, the four env vars, the webhook script), the live versus simulated labels below, and screenshots. `.env.example` is Pramukh's: ask him to add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET` (only `CRON_SECRET` is there now).
6. **Demo walkthrough and the 10-minute video.** Eric records the video. Draft script is at the end of this file. Do not claim a recorded video exists until it does.

### 2. Waiting on Pramukh (he said these can come after the demo)

- Shared groundwork from `Pramuk Tasks.md`: `CoreAgentId` becoming `customer | books | content | internal`, `canonicalAgent`, `ConversationOwner`, `createHandoffCard(session, business, { toSkill, parentKey, contactId, facts })`, `receiveSupplierInvoice`.
- Bookkeeping and Marketing feeds, the validated `agent` field for the shared Ask, and a paid-invoice or job-complete event.
- When these land, replace the stand-ins:
  - Billing questions become an owner note in `lib/server/customer-reply.ts`. Switch to `createHandoffCard`.
  - Forwarded billing, supplier and review email become owner cards in `lib/server/triage.ts`. Switch to the helpers.
  - Stored `frontdesk` and `followup` agent ids are shown as "Customer" by `components/agent-labels.ts`. Map them through `canonicalAgent` instead. The example email card still says "Front Desk" because it reads `CORE_AGENTS` in `lib/domain/agents.ts`.
  - The brief has no Bookkeeping or Marketing numbers yet. Add them in `lib/domain/brief.ts` and `lib/server/brief.ts`.
  - The Bookkeeping and Marketing agent pages need real views. They show unavailable states now.
  - Add the Ask box to each agent page (`AgentWorkspace` already takes an `ask` slot).
  - Review Asker follow-on after a paid event.

### 3. Not built, optional, in priority order

1. **Unsend a Telegram reply within 48 hours.** `deleteTelegramMessage` exists in `lib/connectors/telegram.ts`, and provider message ids are stored on outbox rows and thread messages. Missing: an authorized route (session-scoped, rate-limited in `middleware.ts`, body through `readBody` and Zod), the delete call through the dispatcher, truthful results for expired or already-deleted, and a button on the outbox shown only when the server says it is allowed. Deletion must not claim it undoes reading.
2. **Follow-up timers** for Callback, Closer, Call Follow-up, Reactivator, Keeper, Referral Ask, Debrief and Show-up Keeper reminders. They need recorded dates and job states, deduped by contact and window. Never guess prices or open slots. Nothing exists yet.
3. **License Clerk renewals**: a structured licenses field with evidence, warning windows, one reminder per license per window, time-zone and DST tests. Nothing exists yet.
4. **Model suggestions for email triage** (rules only today), and a model reword of the brief (deterministic text only today). Both must stay validated and budgeted through `getBudgetedLlm`.
5. **Marketing reads of Telegram threads** (`flagThread`, post ideas excluding stopped contacts). Wait for Pramukh's Marketing side.
6. **Owner notifications on Telegram** (stretch in the original tasks).

### 4. Known gaps and risks

- **Never exercised against real Supabase**: the Telegram and brief store methods, `claim_telegram_update`, `claim_brief_run`, and the rule outbox rows. Expect the first live run to find something.
- **Not audited line by line**: the test list in `Eric Tasks.md` section 7 (concurrent approval races, uncertain-send handling, tenant-boundary cases). Many are covered, and some may not be. Audit before claiming completion.
- **AI is off in local runs.** Replies come from the checked templates. If `AI_PROVIDER` is set in Vercel, the model drafts. Say which in the demo and the README.
- **Postmark forwarded-email triage** is covered by tests only. It was never run against a real Postmark webhook.
- **Brief details**: it runs hourly and writes once per local day from 7 a.m. Eastern, and the first run for a business writes whatever has happened so far.
- **npm audit** reports two PostCSS warnings that come from Next's own dependency. They predate this work.
- **Local data resets** on every app restart because local runs use the in-memory store.

## What Pramukh still owes, and what he should hear

**He owes Eric:**
- The `TELEGRAM_WEBHOOK_SECRET` value from Vercel, sent privately, not in an issue.
- `CRON_SECRET` set in Vercel, then the two crons (`/api/cron/dispatch` every 5 minutes, `/api/cron/brief` hourly) once the code PR merges.
- Confirmation that `TELEGRAM_BOT_USERNAME` in Vercel is `AnchorMesageBot`, with one "s". The display name can say "MessageBot", but the username used in links cannot.
- `.env.example` entries for the three Telegram variables.
- After the demo: the shared groundwork, handoff helpers, Bookkeeping and Marketing feeds, and the validated `agent` field (section 2 above).

**He should hear from Eric:**
- The acknowledgment now starts on, and Telegram has no quiet hours (the decisions above). His design docs say otherwise.
- The agent pages live under Workflows with no workflow map, following his revert of PR #45.
- The example email card still says "Front Desk" because it reads his `CORE_AGENTS` list.
- Until his helpers land, billing questions and forwarded billing, supplier and review email show up as plain owner cards.

## How to work

**Checks.** `npx -y node@26 $(which npm) run check` (types, 1,317 tests, build). `lib/architecture.test.ts` enforces the layer rules.

**Run the app on its own port.**
```bash
npm run build
ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p 3102
```
`.env.local` in the worktree holds the Telegram variables (git ignores it). Rebuilding replaces the files a running server uses, so restart it after every build.

**Seed data without a browser.** Create a business with `POST /api/businesses` (`{"from":"sentence","sentence":"..."}`, with an `origin` header matching the host and the `anchored_session` cookie), choose lead follow-up with `PUT /api/businesses/<id>/choices` (`{"workflow":"leads","path":"build"}`), get the link from `GET /api/businesses/<id>/telegram`, then POST updates to `/api/hooks/telegram` with header `x-telegram-bot-api-secret-token`.

**Browser checks.** Headless Chrome through `playwright-core` works: `chromium.launch({ channel: "chrome", headless: true })`, loading `playwright-core` from `~/.npm/_npx/*/node_modules/playwright-core`. Add the `anchored_session` cookie to the context. The Playwright MCP browser is often held by another session.

**Real phone test.** `ngrok http 3102`, then run the webhook script's `set` with the https tunnel address, scan the QR on the Connections page. Use `http://localhost:3102`, not the tunnel address, in your own browser.

**Pushing.** The SSH key needs a passphrase that tools cannot enter. Use the GitHub CLI login: `git -c credential.helper= -c credential.helper='!gh auth git-credential' push https://github.com/pramukhbhushan/Anchored.git HEAD:refs/heads/<branch>`, and the same form for `fetch`. The `gh` account is `ericwei1107`.

## Draft demo script (about 5 minutes of the 10)

1. Open the live site, create a business ("Greenfield Lawn, a lawn care company"), set Lead follow-up to "Anchored drafts it".
2. Connections: show the Telegram link and QR. Scan it with a phone, tap Start, read the welcome.
3. Send "Do you mow lawns on Saturdays?" Show the instant "got your message" reply.
4. Workflows, Customer: the conversation and the waiting draft. Approvals: approve it, and show the reply landing on the phone.
5. Send an allergy question. Show that it locks and Anchored drafts nothing.
6. Send `/stop`. Show that the next send is blocked.
7. Internal Communications: Run now, and read the brief. Show the Overview line.
8. Say what is live and what is not: Bookkeeping, Marketing, follow-up timers and license reminders are not built or are waiting on the shared groundwork.
