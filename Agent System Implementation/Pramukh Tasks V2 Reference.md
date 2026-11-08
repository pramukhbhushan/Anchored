# Pramukh's tasks: Bookkeeping agent and Marketing agent

Nov 8, 2026 · built from `Anchored Agent System Design V2.md` (revised split)

**The split:** Eric owns the dashboard, the demo, the **Customer agent** end to end (Telegram, threads, customer replies, the acknowledgment rule) and **Internal Communications** (triage, the daily brief, renewal reminders). You own the **shared groundwork**, **Bookkeeping** and **Marketing**.

The rule behind every task: **code decides, the model writes text, and the owner approves before anything reaches a customer.**

---

## 0. Before you start

### 0.1 Branches and worktrees

You make two branches: a small groundwork PR that lands first (Eric builds on it), then your agent work.

```bash
cd /Users/pramukhb/Downloads/AI4SB/Anchored/Anchored
git fetch origin
git worktree add ../anchored-groundwork -b feat/agent-groundwork origin/main
git worktree add ../anchored-books-marketing -b feat/books-and-marketing origin/main
cd ../anchored-groundwork && cp ../Anchored/.env.local . && npm ci
```

Use port **3102**. Eric uses 3101. Leave 3000 alone.

```bash
npm run dev -- -p 3102
```

### 0.2 Files you own, files you share

| Kind | Files |
| --- | --- |
| Yours | `lib/domain/agents.ts`, `lib/domain/cards.ts` (Eric edits `CARD_TEMPLATES.triage` and `brief`), `lib/connectors/stripe.ts`, `app/api/hooks/stripe/**`, `app/api/cron/posts/**`, new modules `lib/server/handoff.ts`, `lib/server/supplier-invoice.ts`, `lib/server/posts.ts`, `lib/domain/posts.ts`, `lib/domain/reviews.ts`, migrations `20261108000400_bookkeeping.sql` and `20261108000500_marketing_reviews.sql`, `vercel.json`, `.env.example` |
| Eric's (don't edit) | `components/**`, `app/app/**`, `lib/connectors/telegram.ts`, `app/api/hooks/telegram/**`, `lib/server/telegram-hooks.ts`, `lib/server/customer-reply.ts`, `lib/domain/threads.ts`, `20261108000300_telegram_threads.sql`, `lib/domain/brief.ts`, `app/api/hooks/email/**`, `app/api/cron/brief/**` |
| Shared, additive only | `lib/domain/types.ts`, `lib/domain/contacts.ts`, `lib/domain/executor.ts`, `lib/connectors/email.ts`, `app/api/cron/dispatch/**`, `lib/server/ingest.ts`, `lib/server/dispatch.ts`, `lib/server/decide.ts`, `lib/server/hooks.ts`, `lib/server/data.ts`, `lib/store/**`, `lib/api/**`, `middleware.ts` |

**Shared-file rule:** add new entries, functions and branches. Don't rewrite or reorder code Eric depends on. Message him before you touch a shared file. Whoever merges second fixes conflicts and reruns `npm run check`.

### 0.3 Code to read first

| File | Why |
| --- | --- |
| `lib/domain/agents.ts` | `SKILLS` (`nudger`, `pricewatch`, `posts`, `reviewdrafter`, `reviewer`) and `CORE_AGENTS` |
| `lib/domain/cards.ts` | `CARD_TEMPLATES`: today's rules-written drafts, also your template fallback |
| `lib/server/ingest.ts` | `SOURCE_SKILLS`, `PAYLOADS`, `ingestEvent`: every event enters here |
| `lib/connectors/stripe.ts` | `verifyStripeSignature`, `readUnpaidInvoice` |
| `app/api/hooks/stripe/[hookId]/route.ts`, `lib/server/hooks.ts` | How a Stripe event becomes a card |
| `lib/server/decide.ts`, `lib/server/dispatch.ts`, `lib/domain/executor.ts` | Approve, `checkSend`, send. Bookkeeping reminders go through all three |
| `lib/server/ai.ts`, `lib/server/ai-budget.ts`, `lib/llm/json.ts` | The fact check in `rewriteInVoice`, `getBudgetedLlm`, JSON parsing of model output |
| `supabase/migrations/20261107000400_retention_keeps_accounts.sql` | The 30-day purge pattern you copy for reviews |
| `AGENTS.md`, `docs/architecture.md` | Layer rules, Store rules, conventions |

Repo rules you'll hit: `import "server-only"` in server modules, every Store method takes the session first (deployment-wide ones must return the session id and be documented), append-only migrations, a `LIMITS` entry in `middleware.ts` for each new mutation route, `Module Overview` banner per file, `/** */` per export, no em or en dashes in docs, no AI attribution in commits.

---

## 1. Connecting to everything

| Service | Needed for | Env vars | Status |
| --- | --- | --- | --- |
| Supabase | Data, sign-in, migrations | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Already in `.env.local` |
| AI provider | Model-written reminders, posts, review replies, extraction | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL*`, `AI_DAILY_CALL_CAP` | Already in `.env.local` |
| Stripe (test mode) | Bookkeeping in | Per business: the signing secret, pasted on Connections | Set up below |
| Encryption key | Stores the Stripe secret | `CONNECTOR_SECRET_KEY` (`openssl rand -base64 32`) | Add if missing |
| Postmark inbound | Forwarded supplier invoices (Price Watch) | `INBOUND_EMAIL_ADDRESS`, `INBOUND_EMAIL_SECRET` | Optional; the simulator covers it |
| Resend | Reminder emails | `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` | Optional; without it the owner sends |
| Cron | Sends queued rows, weekly post tick | `CRON_SECRET` (`openssl rand -hex 32`) | Add |
| Public URL | Webhook addresses | `PUBLIC_APP_URL` | Your tunnel URL locally |
| Telegram | Reminders to a customer's chat | Eric sets up the bot | Only after Eric's channel lands |

### 1.1 Supabase

1. Write migrations in `supabase/migrations/`, using your reserved timestamps.
2. Apply them to project `bbtxbipjkubauevtfpqe`:
   - CLI: `npx supabase login`, `npx supabase link --project-ref bbtxbipjkubauevtfpqe`, `npx supabase db push`
   - or Dashboard, SQL Editor, paste, Run.
3. For the review purge: Dashboard, Database, Extensions, turn on **pg_cron**, then schedule it (Task M6).
4. For fast local work, skip Supabase with `ANCHORED_ALLOW_MEMORY_STORE=1`. `MemoryStore` must behave the same, which is why every Store method lands in both backends.

### 1.2 Stripe (test mode)

1. Make a Stripe account and stay in **Test mode**.
2. Install and log in:

   ```bash
   brew install stripe/stripe-cli/stripe
   stripe login
   ```

3. In Anchored, sign in with email or Google. Guests can't connect services unless `ANCHORED_ALLOW_GUEST_CONNECTIONS=1` is set locally. Open Connections, start Stripe, and copy the webhook path `/api/hooks/stripe/<hookId>`.
4. Forward events to your server:

   ```bash
   stripe listen --forward-to localhost:3102/api/hooks/stripe/<hookId> \
     --events invoice.overdue,invoice.payment_failed,invoice.paid
   ```

   Paste the printed `whsec_...` into the Stripe connection.
5. Fire events:

   ```bash
   stripe trigger invoice.payment_failed
   stripe trigger invoice.paid
   ```

   `invoice.overdue` may not be triggerable. Use the `invoice-late` simulator event, or `stripe events resend <evt_id>`.
6. Production: Stripe Dashboard, Developers, Webhooks, add an endpoint at the Vercel URL with the same three events, and paste that secret.

### 1.3 Postmark inbound (optional)

1. Postmark, your server, Inbound stream. Set the webhook URL to `$PUBLIC_APP_URL/api/hooks/email?key=$INBOUND_EMAIL_SECRET`.
2. Put the inbound address in `INBOUND_EMAIL_ADDRESS`. Forward to `<address>+<hookId>@...` so the hook id finds the business.
3. Locally, a tunnel gives Postmark a public URL: `cloudflared tunnel --url http://localhost:3102`.

### 1.4 Cron

Approved cards only go out when dispatch runs:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/dispatch
```

The repo has no `vercel.json` yet. You add it in Task M2. If the Vercel plan only allows daily crons, an outside scheduler (cron-job.org, a GitHub Action) calls the same URLs with the same bearer token.

---

## 2. Shared groundwork (one small PR, lands first)

Eric branches his Customer work from this, so keep it small and land it fast.

### Task G1. Agent ids and characters

**Files:** `lib/domain/types.ts`, `lib/domain/agents.ts`, `lib/domain/agents.test.ts`.

1. `CoreAgentId` becomes `"customer" | "books" | "content" | "internal"`. Every `frontdesk` or `followup` skill now points at `customer`. Keep all 19 skills.
2. `canonicalAgent(id: string): CoreAgentId | null` maps old `frontdesk` and `followup` values to `customer`. Use it wherever stored agent ids are read back.
3. `ConversationOwner` becomes `"customer" | "books" | "closed"`.
4. Add `character: { role, voice, never }` to `CoreAgentDef`, filled for all four agents from the design doc, plus `characterPrompt(agent)` that turns `voice` and `never` into prompt lines.
5. Tell Eric the new ids so he updates `components/agent-labels.ts`.

### Task G2. Handoff and stake columns

**Migration `20261108000400_bookkeeping.sql`** (the groundwork part):
- `cards.parent_key text`: the card a handoff came from.
- `cards.stake numeric`: the dollars involved, for ranking.
- `cards.invoice_number text` with an index on `(session_id, business_id, invoice_number)`. Bookkeeping needs it, and adding it now saves a second migration.

Add the fields to `CardDraft`/`CardRecord` and to both Store backends.

### Task G3. `createHandoffCard`

**File:** new `lib/server/handoff.ts` + test.

`createHandoffCard(session, business, { toSkill, parentKey, contactId, facts })`: checks the business chose `toSkill` and returns `null` if not. Otherwise it builds the card from `CARD_TEMPLATES[toSkill]` with the facts, sets `parent_key`, saves it through `ensureCards`, and returns the key. Eric calls this for billing questions on a Telegram thread and from Internal Communications triage.

**Done when:** `npx vitest run lib/domain/agents.test.ts lib/server/handoff.test.ts lib/store/memory.test.ts lib/architecture.test.ts` passes, then `npm run check`, then the PR.

---

## 3. Agent 2: Bookkeeping

### What it does

It watches money owed to the business. When a Stripe invoice is overdue or a payment fails, it drafts a polite reminder with the exact amount and invoice number, at most two per invoice. When the invoice is paid, it cancels any reminders still waiting and starts a review request. It also reads forwarded supplier invoices and flags price increases. It never moves money, and the owner approves every card.

**Character:** plain and friendly, states the amount and invoice number once, assumes the customer forgot. **Never** states an amount not from Stripe or the invoice, adds a late fee, threatens, or sends more than two reminders per invoice.

### What you're using

| Piece | Role |
| --- | --- |
| Stripe webhooks (`Stripe-Signature`, per-business secret) | `invoice.overdue`, `invoice.payment_failed`, `invoice.paid` in |
| Stripe CLI | Local testing |
| `ingestEvent` sources `invoice-late`, `invoice-paid` (new), `invoice` | Turn events into cards |
| Postmark inbound + triage | Forwarded supplier invoices |
| `decideCard`, `checkSend`, `dispatch` | Approve and send, with quiet hours, STOP and consent |
| Resend, or Telegram once Eric's channel lands | Reminders out |

### Flow

```
Stripe ──> POST /api/hooks/stripe/<hookId> ──> verify signature
  overdue/failed ──> readUnpaidInvoice ──> ingestEvent("invoice-late")
       ──> 2 reminders already for this invoice? stop, record event
       ──> Payment Nudger card (amount + number from Stripe, stake = amount)
  paid ──> readPaidInvoice ──> ingestEvent("invoice-paid")
       ──> skip pending Nudger cards + cancel unclaimed outbox rows for that invoice
       ──> Review Asker card (Customer agent's skill) if chosen
Forwarded supplier email ──> triage ──> extractor (numbers must appear in the email) ──> "invoice" event ──> Price Watch card
Owner approves ──> decideCard ──> outbox ──> dispatch (Telegram if contact has a chat, else email, else owner sends)
```

### Task B1. `invoice.paid` reader and `invoice-paid` source

**Files:** `lib/connectors/stripe.ts` + test, `app/api/hooks/stripe/[hookId]/route.ts`, `lib/server/hooks.ts`, `lib/server/ingest.ts`.

1. `readPaidInvoice(event)`: Zod parse of `invoice.paid`, USD only, returns `{ number, customerEmail, customerName, amountPaid }` (cents divided by 100).
2. Route: after the signature check, try `readUnpaidInvoice`, then `readPaidInvoice`, and call `receiveUnpaidInvoice` or a new `receivePaidInvoice`. Update the `Module Overview`.
3. Add `invoice-paid` to `SOURCE_SKILLS` (`["reviewer"]` for the fan-out) and to `PAYLOADS` (strict object: `number`, `amount`, optional `name`, `email`). Also add it to the simulator so guests can test it.

### Task B2. Cancel reminders when an invoice is paid

**Files:** `lib/server/ingest.ts`, a new Store method in all three store files.

1. Nudger cards save `invoice_number` (from Task G2).
2. `skipCardsForInvoice(session, businessId, invoiceNumber)`: marks pending Nudger cards skipped (only while still pending, same rule as `updatePendingCard`) and cancels outbox rows for that invoice that haven't been claimed. Returns `{ cards, outbox }` counts. `reset` already clears cards and outbox.
3. On `invoice-paid`, call it and record the event so the brief can say "Invoice 1042 paid, 1 reminder canceled."
4. Fan out: a Review Asker card for the same contact, if the business chose `reviewer` and Task M5's double-contact check allows it.

### Task B3. At most two reminders per invoice

Pure rule in `lib/domain/` (for example `canRemind(existing: readonly CardRecord[], invoiceNumber)`), called from ingest before drafting. Count approved and pending Nudger cards for that invoice. Two or more: no card, but record the event so the owner still sees it. An invoice with no number is matched by customer email plus amount.

### Task B4. Reminder content, `stake`, delivery

**Files:** `lib/domain/cards.ts` (`CARD_TEMPLATES.nudger`), `lib/domain/contacts.ts` (`deliveryFor`, shared).

1. Template uses only `amount` and `number` from the event. No late-fee wording, no threats.
2. If the model rewrites it in the owner's voice, the fact check must refuse any number not in the event. Fall back to the template.
3. Set `stake` to the amount due.
4. Find the contact by email, then name. Delivery today: email through Resend, else "owner sends it." After Eric's Telegram channel lands, add one branch to `deliveryFor`: a contact with a Telegram chat and no STOP gets Telegram. That's an additive edit in a shared file; tell Eric first.
5. Bookkeeping cards never use a standing rule. Every one waits for the owner.

### Task B5. Billing questions from the Customer agent

You provide `createHandoffCard` (Task G3). Eric calls it when a Telegram message asks about a bill. Your part: when `toSkill` is `nudger`, look up the latest `invoice-late` event for that contact and add its number and amount to the card. If none exists, make a note card for the owner that repeats the customer's question and states no amount.

### Task B6. Supplier invoice extraction (Price Watch)

**Files:** new `lib/server/supplier-invoice.ts` + test, `lib/server/ingest.ts`.

1. Export `receiveSupplierInvoice(session, business, email)`. Eric's triage calls it when it labels a forwarded email a supplier invoice. It returns the Price Watch card key or `null`.
2. The model returns JSON `{ supplier, item, oldPrice, newPrice }`. Parse it with `lib/llm/json.ts` and a Zod schema, and call the model through `getBudgetedLlm`.
3. Code keeps a number only if that exact number appears in the email text, and drops the field otherwise.
4. Without AI, a regex pass finds `$x.xx` near item words. If it finds nothing, no card is made.
5. A valid result becomes an `invoice` event, which `pricewatch` drafts. Set `stake` to the price difference times quantity, if a quantity is in the email.

### Task B7. Agent page reads and brief feed for Bookkeeping

Add to `lib/server/data.ts` (shared, additive) a read for Eric's Bookkeeping page: the character, enabled skills, pending cards ranked by `stake`, the overdue total, and recent paid or canceled events. Also expose the numbers Eric's daily brief and overview rows show (overdue total, reminders waiting, reminders canceled, price increases), computed in code. Agree on the shapes with Eric in writing first.

---

## 4. Agent 3: Marketing

### What it does

It keeps the business visible. It drafts social and Google posts from real things the business did, and drafts replies to reviews, flagging bad ones for the owner. It publishes nothing itself. The owner approves a draft, taps Copy, and pastes it where it goes.

**Character:** writes about one real thing per post, thanks reviewers for what they mentioned, stays calm with bad reviews. **Never** invents a price, an award or a guarantee, names a customer without permission, offers anything in return for a rating, or argues with a reviewer.

### What you're using

| Piece | Role |
| --- | --- |
| `list` channel (copy and paste) | Every approved draft, with a Copy button and a destination link |
| Vercel Cron (or an outside scheduler) | Weekly post tick |
| `review` events from the simulator or a pasted review in Chat | Review Drafter in |
| Shared record: bookings, paid invoices, Eric's thread messages, the profile | Post ideas |
| `getBudgetedLlm` + a fact check | Post and reply text |
| pg_cron | 30-day review text purge |

Google Business Profile and Meta posting stay out of scope ("Later" in the design doc).

### Flow

```
Weekly cron tick ─┐
Finished job ─────┼──> build PostContext in code (profile services/offers, recent jobs, good threads; no names unless allowed)
Owner asks in Chat┘      ──> model writes one post per channel the profile lists
                         ──> fact check: no price/award/guarantee/name not allowed ──> (fail) template
                         ──> Post Drafter card (channel "list", action "Copy post")
Review event ──> reviewdrafter ──> reply that cites one detail, no offer
            ──> bad review? ──> owner flag + flag on the matching customer's thread
Owner approves ──> outbox row shows Copy + link to Google profile or social page
pg_cron daily ──> clear review text older than 30 days
```

### Task M1. Marketing character

Done in G1. Check that `content.character.never` lists all four limits and that Tasks M3 and M4 enforce each one in code.

### Task M2. Weekly post tick and cron config

**Files:** new `app/api/cron/posts/route.ts`, `lib/server/posts.ts`, a deployment-wide Store method, new `vercel.json`.

1. The route needs `Authorization: Bearer $CRON_SECRET`, the same as dispatch.
2. Add a Store method `listBusinessesWithSkill(skill, limit)`. It's deployment-wide and returns each row's session id, like `listDueOutbox`. Explain why in `docs/architecture.md` and in `AGENTS.md`'s list of deployment-wide methods.
3. For each business that chose `posts`, create one card keyed `posts:<businessId>:<YYYY-Www>`, so `ensureCards` makes one per week even if the cron fires twice.
4. Add a "Run now" route for the demo, `POST /api/businesses/[id]/posts`, using the visitor's session. Give it a `LIMITS` entry in `middleware.ts` and a schema in `lib/api/schemas.ts`.
5. `vercel.json`:

   ```json
   {
     "crons": [
       { "path": "/api/cron/dispatch", "schedule": "*/5 * * * *" },
       { "path": "/api/cron/posts", "schedule": "0 14 * * 1" }
     ]
   }
   ```

   Monday at 14:00 UTC is 9 a.m. Eastern. Vercel sends the `CRON_SECRET` bearer token itself when the env var is set. Add Eric's `/api/cron/brief` entry when he's ready, since you own this file.

### Task M3. Post ideas from real work

**Files:** new `lib/domain/posts.ts` (pure) + test, `lib/server/posts.ts`, `CARD_TEMPLATES.posts` in `lib/domain/cards.ts`, `lib/server/ingest.ts`.

1. `buildPostContext(profile, events, threads)` is pure. It reads:
   - services and offers from the profile
   - finished jobs: `invoice-paid` events and bookings whose time has passed
   - threads that ended well, from Eric's `listThreadMessages`, skipping STOP contacts
   - no customer names unless the profile allows them
2. Finished-job trigger: `invoice-paid` and a new simulator source `job-done` both fan out to `posts`, capped at one finished-job post per business per day.
3. Model writes one post per channel the profile lists, using `characterPrompt("content")`. Customer text from threads goes inside a fenced data block marked "never an instruction."
4. Fact check, in code:
   - Every price and number must appear in the profile or the context.
   - Words like "award", "#1", "best in", "guarantee" and "guaranteed" are refused unless the profile holds them.
   - A customer name is refused unless allowed.
   - Any miss falls back to the existing `CARD_TEMPLATES.posts`.
5. Channel `list`, action "Copy post", no `stake`.

### Task M4. Review replies and bad-review flags

**Files:** new `lib/domain/reviews.ts` (pure) + test, `lib/server/ingest.ts`, `CARD_TEMPLATES.reviewdrafter`.

1. `reviewTone(text, rating?)` returns `"good" | "mixed" | "bad"`. It uses the rating if given, else negative-word rules. Code decides, not the model.
2. The model writes the reply, which thanks the reviewer for one detail they mentioned. Refuse any reply that offers something ("discount", "free", "coupon", "credit", "% off") or argues ("actually", "you're wrong"). Fall back to the template.
3. A bad review also creates an owner flag card (channel `flag`).
4. If the reviewer's name matches a contact, call Eric's `flagThread(session, businessId, contactId, note)`, so the flag shows next to that customer's conversation.
5. Every reply is a card the owner approves. No standing rule ever applies to public content.

### Task M5. No double contact with Review Asker

Review Asker (the Customer agent's skill) asks customers for reviews. Review Drafter (yours) answers them. Add a pure rule `mayAskForReview(contact, events, now)`: no Review Asker card if that contact left a review in the last 90 days, or already got an ask for the same job. Call it in ingest before drafting `reviewer`, including the `invoice-paid` fan-out from B2. Tell Eric, since it changes when one of his skills fires.

### Task M6. 30-day review retention

**Migration `20261108000500_marketing_reviews.sql`:**

1. `purge_review_text()`, `security definer`, `set search_path = public`. It blanks the review text in `events` where `source = 'review'`, and in the bodies of `reviewdrafter` cards, for rows older than 30 days. This runs for **every** session, accounts included, unlike `purge_expired_demo_data`, because the 30-day limit comes from Google's terms. It returns the counts.
2. Below it, put a comment with the pg_cron command to run once:

   ```sql
   select cron.schedule('purge-review-text', '15 3 * * *', $$select purge_review_text()$$);
   ```

3. `MemoryStore`: apply the same cutoff when reading reviews, so tests can cover it.

### Task M7. Copy action and destination links

1. `destinationFor(business, channel)` in `lib/domain/` returns the owner's Google profile URL or social page from the profile, or `null`.
2. Outbox rows for Marketing cards carry it, so Eric's Copy button can link to it.
3. Add a Marketing page read to `lib/server/data.ts`: the character, enabled skills, waiting drafts, recently copied posts, and open review flags. Also expose the brief feed (posts waiting, review flags open). Agree on the shapes with Eric.

---

## 5. Testing

While you work, run only the tests for files you changed. Run `npm run check` once before each PR.

### 5.1 Unit tests (no keys needed)

```bash
npx vitest run lib/domain/agents.test.ts lib/server/handoff.test.ts      # groundwork
npx vitest run lib/connectors/stripe.test.ts app/api/hooks/hooks.test.ts # Bookkeeping in
npx vitest run lib/server/supplier-invoice.test.ts lib/domain/cards.test.ts
npx vitest run lib/domain/posts.test.ts lib/domain/reviews.test.ts lib/server/posts.test.ts
npx vitest run lib/store/memory.test.ts lib/server/decide.test.ts lib/server/dispatch.test.ts
npx vitest run lib/architecture.test.ts                                   # after adding any module
```

| Test | Must prove |
| --- | --- |
| `agents.test.ts` | `canonicalAgent("frontdesk")` and `("followup")` are `customer`; all 19 skills have an agent; all four agents have a character |
| `handoff.test.ts` | Unchosen skill returns `null`; `parent_key` is set; a billing handoff with no invoice states no amount |
| `stripe.test.ts` | `readPaidInvoice` reads USD; ignores EUR and other event types |
| `hooks.test.ts` | Bad signature is 400 with no card; paid event cancels a pending reminder and an unclaimed outbox row; third reminder is refused |
| `cards.test.ts` | Nudger body contains only the event's amount and number; no "late fee" |
| `supplier-invoice.test.ts` | A number the email doesn't contain is dropped; no AI uses the regex fallback |
| `posts.test.ts` (domain) | Context skips STOP contacts and names; fact check refuses a made-up price, "award-winning" and a customer name |
| `posts.test.ts` (server) | Cron without the bearer token is 401; two ticks in one week make one card |
| `reviews.test.ts` | Tone from rating and words; a reply offering a discount is refused; a bad review makes a flag; `mayAskForReview` blocks within 90 days |
| `memory.test.ts` | `skipCardsForInvoice`, `listBusinessesWithSkill`, the review cutoff; session A can't see B's data |
| `decide.test.ts` | A Bookkeeping or Marketing card never sends without an owner decision |

### 5.2 Manual test without outside services

```bash
# comment out AI_PROVIDER in .env.local for the first pass
ANCHORED_ALLOW_MEMORY_STORE=1 npm run dev -- -p 3102
```

Open `http://localhost:3102`, continue as a guest, and onboard a business (or use your own). Then send events with the simulator, or with curl using your browser's `Cookie` header from DevTools:

```bash
B=<businessId>; C='<paste Cookie header>'
post() { curl -s "http://localhost:3102/api/ingest/$1" -H "Content-Type: application/json" -H "Cookie: $C" -d "{\"businessId\":\"$B\",\"payload\":$2}"; echo; }

post invoice-late '{"name":"Sam Lee","email":"sam@example.com","amount":240,"number":"1042","kind":"overdue"}'
post invoice-late '{"name":"Sam Lee","email":"sam@example.com","amount":240,"number":"1042","kind":"overdue"}'
post invoice-late '{"name":"Sam Lee","email":"sam@example.com","amount":240,"number":"1042","kind":"overdue"}'
post invoice-paid '{"name":"Sam Lee","email":"sam@example.com","amount":240,"number":"1042"}'
post invoice '{"supplier":"Sysco","item":"Chicken thighs","oldPrice":2.10,"newPrice":2.50}'
post review '{"author":"Dana","text":"Cold food and we waited 40 minutes. Not coming back."}'
post review '{"author":"Lee","text":"The brisket was amazing and the staff were so kind."}'
post job-done '{"name":"Sam Lee","what":"Furnace tune-up"}'
```

What you should see in Approvals:

| Step | Expect |
| --- | --- |
| First two `invoice-late` | Two reminders with $240 and #1042, by template |
| Third `invoice-late` | No new card |
| `invoice-paid` | Pending reminders skipped; a Review Asker card if chosen |
| `invoice` | Price Watch card: up $0.40 at Sysco |
| Bad review | Calm reply draft plus an owner flag |
| Good review | Reply that mentions the brisket, no offer |
| `job-done` | A Post Drafter card about the tune-up, no customer name |

Then run the weekly tick by hand:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/posts
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/posts   # second call: no new card
curl -s http://localhost:3102/api/cron/posts                                            # no token: 401
```

Turn AI back on and repeat. The drafts should now be model-written and still pass the same checks. Set `AI_DAILY_CALL_CAP=0` once to confirm every draft still appears from templates.

### 5.3 Live Stripe test

1. Signed-in account, Stripe connection saved with the `whsec_` from `stripe listen`.
2. `stripe trigger invoice.payment_failed`. The listen window shows `200`, and a Nudger card shows the test invoice's amount.
3. Add a contact with that invoice's customer email. Approve, run dispatch, and expect a Resend email (or "owner sends it" without Resend).
4. Pay the same invoice. Expect the pending reminders canceled.
5. Tamper check: `curl -X POST localhost:3102/api/hooks/stripe/<hookId> -H "Stripe-Signature: t=1,v1=bad" -d '{}'` returns 400 with no card.

### 5.4 Review retention test

In the Supabase SQL Editor:

```sql
update events set received_at = now() - interval '31 days' where source = 'review' and business_id = '<id>';
select * from purge_review_text();
select payload from events where source = 'review' and business_id = '<id>';   -- text cleared
```

Then check `select * from cron.job;` lists `purge-review-text`.

### 5.5 After Eric's Customer agent lands

- Send "I got charged twice on my last bill" to the business's Telegram link. Expect a Bookkeeping handoff card linked to the Customer card.
- Give a Telegram contact an overdue invoice. Approve the reminder, dispatch it, and receive it in Telegram. Send `/stop`, and the next reminder is refused.
- Send a bad review from a name that matches a Telegram contact. Expect the flag on that customer's thread.
- Check that post ideas include a finished conversation and never a STOP contact.

### 5.6 Before each PR

```bash
git fetch origin && git merge origin/main
npm run check
```

Follow `.claude/skills/land-a-pr/SKILL.md`. Then run the combined checks from the design doc with Eric: a paid-invoice cancellation, a Marketing copy action, and a brief refresh that shows your Bookkeeping and Marketing numbers.

---

## 6. Suggested order

| # | Task | Why |
| --- | --- | --- |
| 1 | G1 to G3 groundwork PR | Eric is blocked on the ids and the handoff helper |
| 2 | B1, B2, B3 | Paid invoices and the reminder limit, testable with the Stripe CLI |
| 3 | B4 | Reminder content and email delivery |
| 4 | M4, M5 | Review replies and flags work from the simulator alone |
| 5 | M2, M3 | Post tick and post ideas |
| 6 | M6, M7 | Retention, copy links |
| 7 | B6 | Supplier extraction, the most model-heavy task |
| 8 | B5, B4 Telegram branch, B7 | After Eric's Customer branch lands |

---

## 7. Summary: what you're building

You're building the back end for two agents, plus the small shared base Eric's Customer agent sits on.

**Bookkeeping** listens to the owner's Stripe account. When an invoice is late or a payment fails, it drafts a friendly reminder using only the amount and invoice number Stripe sent, never more than two per invoice. When the invoice is paid, it cancels any reminders still waiting and starts a review request. It reads supplier invoices the owner forwards and flags price increases, keeping only numbers that appear in the email. It never moves money, and the owner approves every reminder.

**Marketing** keeps the business visible without posting anything itself. Once a week, after a finished job, or when the owner asks, it drafts a post about one real thing the business did. Code throws out any made-up price, award, guarantee or customer name. It drafts replies to reviews that thank the reviewer for something specific, never offers a deal for a rating, and flags bad reviews next to that customer's conversation. The owner approves a draft, taps Copy and pastes it. Review text is wiped after 30 days.

**What connects to what:** Stripe test mode with the Stripe CLI, your existing Supabase project (new columns, a review purge on pg_cron), Claude through the budgeted model layer with template fallbacks, Vercel Cron for sends and the weekly tick, and optionally Postmark for forwarded email and Resend for reminder email. Telegram comes from Eric.

**How you'll know it works:** unit tests per module, a simulator run with AI off and then on, a live Stripe trigger, a retention check in SQL, and one combined phone test with Eric once his Customer agent is merged.
