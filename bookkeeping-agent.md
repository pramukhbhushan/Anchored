# Bookkeeping agent: subtasks

Nov 8, 2026 · branch `bookkeeping-agent` · owner Pramukh

## What the agent does

Bookkeeping (`books`) watches money owed to the business. When an invoice is late, it drafts a polite reminder with the exact amount and invoice number, at most two per invoice. When the invoice is paid, it cancels any reminders still waiting. It also flags supplier price increases from forwarded invoices. It never moves money, and the owner approves every card.

**Character.** Plain and friendly. It states the amount and invoice number once and assumes the customer forgot. **Never:** states an amount the owner or the invoice didn't give, adds a late fee, threatens, or sends more than two reminders for one invoice.

## Spreadsheet upload follow-up (Nov 8, 2026)

- **Current flow:** The owner pastes a Google Sheets link into Chat or onboarding and shares the sheet with Anchored's service account as a Viewer. Anchored reads the first tab. The owner can refresh it with "check my invoice sheet" or the "Check my invoice sheet now" button.
- **TODO:** Add direct spreadsheet file upload so owners can provide their invoice spreadsheet from their computer. Support CSV and Excel (.xlsx) files alongside the existing Google Sheets link flow. BK8 below covers the initial CSV upload work; extend it for Excel support.
- Uploaded rows should use the same invoice validation, overdue and paid events, duplicate prevention, and approval flow as the linked sheet. Report missing columns and invalid rows clearly. Treat an upload as a snapshot; the owner uploads an updated file to refresh it.

## Where invoices come from (no Stripe for the demo)

| Source | Status | Use |
| --- | --- | --- |
| **Owner tells Chat**: "Sam Lee owes $240 on invoice 1042, due Oct 20" / "Sam paid 1042" | Build (BK7) | Main demo path. Works for guests, no setup |
| **CSV upload** of unpaid invoices exported from Excel, QuickBooks, Wave, Square or Sheets | Build if time allows (BK8) | Second path; needs Eric's upload button |
| **Simulator** `invoice-late`, `invoice-paid` events | Exists, extend (BK3) | Backup if anything fails live |
| Stripe webhooks | Code exists; no account for the demo | Later |

Every source becomes the same two events, `invoice-late` and `invoice-paid`. Everything after that (the cap, the cancel, the draft, the approval) is shared.

```
Chat / CSV / simulator ──> invoice-late ──> under 2 reminders? ──> Payment Nudger card (amount + number from the source, stake = amount)
                       └─> invoice-paid ──> skip pending reminders + cancel unsent outbox rows ──> (optional) Review Asker card
Forwarded supplier email ──> triage (Eric) ──> receiveSupplierInvoice ──> Price Watch card
Owner approves ──> decideCard ──> checkSend ──> outbox ──> dispatch (email, else "owner sends it"; Telegram later)
```

---

## Before you start

**You need:**
- Node 26 (`.nvmrc`), and `npm ci` done in this worktree.
- `.env.local`: Supabase and AI keys are already set. Add `CRON_SECRET` (`openssl rand -hex 32`) to test dispatch by hand. `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` are optional; without them the owner sends reminders themselves.
- To test without Supabase: `ANCHORED_ALLOW_MEMORY_STORE=1`.
- Your port: **3102**.

**Read first:** `lib/server/ingest.ts` (`SOURCE_SKILLS`, `PAYLOADS`, `ingestEvent`), `lib/domain/requests.ts` (`readRequest`; `nudger` already has a chat cue on line 120), `lib/domain/cards.ts` (`CARD_TEMPLATES.nudger`), `lib/server/decide.ts`, `lib/server/dispatch.ts`, `lib/domain/executor.ts`, `lib/store/types.ts`.

**Repo rules:** every Store method lands in `types.ts`, `memory.ts` and `supabase.ts`, and `reset` clears it. Migrations are append-only, and yours is `20261108000400_bookkeeping.sql`. New mutation routes get a `LIMITS` entry in `middleware.ts`. Every file gets a `Module Overview` banner and every export a `/** */` line. No em or en dashes.

**Shared files** (`ingest.ts`, `types.ts`, `contacts.ts`, `executor.ts`, `dispatch.ts`, `decide.ts`, `requests.ts`, `lib/store/**`, `lib/api/**`, `middleware.ts`): additive edits only, and tell Eric before you touch one.

---

## Subtasks

Each subtask lists what it is, what you need, the files, what to run, and when it's done.

### BK1. Invoice rules (pure domain)

**What:** One place for invoice logic with no I/O: an `Invoice` type, `invoiceKey(invoice)` (the number, or email plus amount when there's no number), `canRemind(existingCards, key)` (false at two), and `amountsIn(text)` / `invoiceNumbersIn(text)` that read `$240`, `$1,240.50`, `#1042` and `invoice 1042` from text.

**You need:** nothing external. No keys.

**Files:** new `lib/domain/invoices.ts`, `lib/domain/invoices.test.ts`.

**Depends on:** nothing. **Start here.**

**Run:**
```bash
npx vitest run lib/domain/invoices.test.ts
```

**Done when:** tests cover the 0, 1, 2 and 3 reminder cases, amounts with commas and cents, no-number invoices, and text with no amount (returns empty).

**Time:** 30 min.

### BK2. Card columns and Store method (migration)

**What:** Add `invoice_number text`, `stake numeric` and `parent_key text` to `cards`, with an index on `(session_id, business_id, invoice_number)`. Add the fields to `CardDraft`/`CardRecord`. Add the Store method `skipCardsForInvoice(session, businessId, invoiceNumber)`. It marks pending `nudger` cards skipped (only while pending), cancels outbox rows for that invoice that haven't been claimed, and returns `{ cards, outbox }`.

If the groundwork PR (`stake`, `parent_key`) has already landed on `main`, only add `invoice_number` and the method.

**You need:** Supabase access to apply the migration. Use `npx supabase db push` after `npx supabase link --project-ref bbtxbipjkubauevtfpqe`, or paste the file into the Dashboard SQL Editor.

**Files:** `supabase/migrations/20261108000400_bookkeeping.sql`, `lib/domain/types.ts`, `lib/store/types.ts`, `lib/store/memory.ts`, `lib/store/supabase.ts`, `lib/store/memory.test.ts`.

**Depends on:** nothing. It can run alongside BK1.

**Run:**
```bash
npx vitest run lib/store/memory.test.ts
npx vitest run lib/architecture.test.ts
```

**Done when:** memory tests prove that skipping touches only pending cards for that invoice in that session, a second session is untouched, and claimed outbox rows are left alone. The migration applies cleanly.

**Time:** 45 min.

### BK3. `invoice-paid` event and simulator

**What:** Add `invoice-paid` to `SOURCE_SKILLS` (`["reviewer"]` for the optional review fan-out) and to `PAYLOADS` as a strict object with `number`, `amount`, and optional `name` and `email`. Add a `due` (date string) field to the `invoice-late` payload. The simulator route picks both up automatically from `EVENT_SOURCES`.

**You need:** nothing external.

**Files:** `lib/server/ingest.ts`.

**Depends on:** nothing.

**Run:**
```bash
npx vitest run app/api/hooks/hooks.test.ts lib/server/feed.test.ts
```

**Done when:** a simulated `invoice-paid` event is accepted, and one with extra fields is refused.

**Time:** 20 min.

### BK4. Two-reminder cap and cancel on payment (wiring)

**What:** In `ingestEvent`:
- For `invoice-late`, call `canRemind`. At two reminders, record the event and make no card.
- For `invoice-paid`, call `skipCardsForInvoice` and record the counts, so the brief can say "Invoice 1042 paid, 1 reminder canceled."
- Save `invoice_number` and `stake` on every Nudger card.

**You need:** BK1, BK2, BK3.

**Files:** `lib/server/ingest.ts`, a new `lib/server/ingest.test.ts` (or extend `hooks.test.ts`).

**Run:**
```bash
npx vitest run lib/server/ingest.test.ts
```

**Done when:** three `invoice-late` events for #1042 make two cards, then `invoice-paid` for #1042 skips the pending ones and leaves a sent one alone.

**Time:** 30 min.

### BK5. Reminder wording and fact check

**What:**
- `CARD_TEMPLATES.nudger` uses only the event's `amount`, `number` and `due`. It contains no late-fee words and no threats.
- If the model rewrites the reminder in the owner's voice, code refuses any number not in the event and falls back to the template. Reuse the check `rewriteInVoice` uses in `lib/server/ai.ts`.
- `stake` = amount.
- The `never` list in `books.character` matches these rules.

**You need:** AI keys only to test the rewrite path (already set). Template tests need no keys.

**Files:** `lib/domain/cards.ts`, `lib/domain/cards.test.ts`, `lib/domain/agents.ts`.

**Run:**
```bash
npx vitest run lib/domain/cards.test.ts lib/domain/agents.test.ts
```

**Done when:** a test proves the body contains `$240` and `1042` and no other amount. A rewrite that adds "$25 late fee" is refused.

**Time:** 30 min.

### BK6. Delivery

**What:** Find the contact by email, then by name, and check `deliveryFor`. With Resend set up and a contact email, Anchored sends the email. Otherwise the outbox row says the owner sends it. Bookkeeping cards never use a standing rule. Leave the Telegram branch for after Eric's channel lands.

**You need:** optional `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` (Resend's free tier, with a verified domain), and `CRON_SECRET` to run dispatch.

**Files:** `lib/domain/contacts.ts` (shared), `lib/server/dispatch.ts` (shared, only if needed).

**Run:**
```bash
npx vitest run lib/domain/contacts.test.ts lib/server/dispatch.test.ts lib/server/decide.test.ts
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/dispatch
```

**Done when:** an approved reminder to a contact with an email is sent, or marked "owner sends it" without Resend. A STOP contact is refused with a plain reason.

**Time:** 20 min.

### BK7. Chat input (main demo path)

**What:** The owner types invoice facts into the business chat.
- "Sam Lee owes $240 on invoice 1042, due Oct 20" becomes an `invoice-late` event.
- "Sam paid 1042" or "invoice 1042 is paid" becomes an `invoice-paid` event.

Code reads the name, amount, number and due date with BK1's readers, and keeps only values that appear in the owner's words. A missing amount gets a question back: "How much does Sam owe?" Paid cues ("paid", "settled", "cleared") must win over the existing `nudger` cue on line 120.

**You need:** nothing external. It works with AI off (rules) and on (the model may write the words only).

**Files:** `lib/domain/requests.ts` (shared), `lib/domain/requests.test.ts`, `lib/server/business-chat.ts` (shared), `lib/server/business-chat.test.ts`.

**Depends on:** BK1, BK3, BK4.

**Run:**
```bash
npx vitest run lib/domain/requests.test.ts lib/server/business-chat.test.ts
```

**Done when:**
- "Sam owes $240 on 1042" makes one Nudger card with $240 and #1042.
- "Sam paid 1042" cancels it.
- "Sam owes money" asks for the amount and makes no card.
- A message whose amount the owner never typed can't create a card with an amount.

**Time:** 60 min.

### BK8. CSV upload (if time allows)

**What:** `parseInvoiceCsv(text)` is pure. It reads columns `Invoice #`, `Customer`, `Email`, `Amount`, `Due date`, `Status` (case-insensitive, extra columns ignored, bad rows reported). Route `POST /api/businesses/[id]/invoices` takes the CSV text (max 200 rows, 100 KB). Each overdue unpaid row becomes `invoice-late`, and each `Paid` row becomes `invoice-paid`. Re-uploading the same file makes no duplicate cards. The route returns counts, such as "3 reminders drafted, 1 canceled, 2 rows skipped."

**You need:** nothing external. Eric adds the upload button. You can test with `curl` before he does.

**Files:** new `lib/domain/invoice-csv.ts` + test, new `app/api/businesses/[id]/invoices/route.ts`, `lib/api/schemas.ts` (shared), `middleware.ts` (shared, a `LIMITS` entry).

**Depends on:** BK1, BK4.

**Run:**
```bash
npx vitest run lib/domain/invoice-csv.test.ts
curl -s http://localhost:3102/api/businesses/<id>/invoices -H "Content-Type: application/json" -H "Cookie: <paste>" \
  -d '{"csv":"Invoice #,Customer,Email,Amount,Due date,Status\n1042,Sam Lee,sam@example.com,240,2026-10-20,Unpaid"}'
```

**Done when:** the parser tests cover a good file, a missing column, a bad amount and a duplicate upload, and the route returns counts.

**Time:** 60 to 75 min.

### BK9. Price Watch: supplier invoices

**What:** `receiveSupplierInvoice(session, business, email)` reads a forwarded supplier invoice. The model may return `{ supplier, item, oldPrice, newPrice }` as JSON, parsed through `lib/llm/json.ts` with a Zod schema and called through `getBudgetedLlm`. Code keeps a number only if it appears in the email text. With no AI, a regex pass runs, and if it finds nothing, no card is made. A valid result becomes an `invoice` event, which `pricewatch` drafts.

**You need:** AI keys for the model path. Eric's triage calls this function. Test it directly, or with the simulator's `invoice` event.

**Files:** new `lib/server/supplier-invoice.ts` + test, `lib/server/ingest.ts` (shared).

**Depends on:** nothing. It can run in parallel with BK1 to BK4.

**Run:**
```bash
npx vitest run lib/server/supplier-invoice.test.ts
```

**Done when:** a number the email doesn't contain is dropped, the no-AI path works, and a real-looking supplier email produces "Chicken thighs went up $0.40 at Sysco."

**Time:** 45 to 60 min.

### BK10. Bookkeeping page data and brief feed

**What:** Read functions in `lib/server/data.ts` for Eric's Bookkeeping page:
- the character
- enabled skills
- pending cards ranked by `stake`
- the overdue total
- recent paid and canceled events

Also a brief feed: overdue total, reminders waiting, reminders canceled, price increases. Every number is computed in code. Agree on the shapes with Eric in writing first.

**You need:** Eric's agreement on the shapes.

**Files:** `lib/server/data.ts` (shared), `lib/server/data.test.ts`, `lib/api/contract.ts` (shared).

**Depends on:** BK4.

**Run:**
```bash
npx vitest run lib/server/data.test.ts
```

**Done when:** tests prove the totals match the cards, and session A can't see session B's totals.

**Time:** 30 min.

### BK11. After Eric's branches land

**What:**
- Add the Telegram branch to `deliveryFor`, so a contact with a chat and no STOP gets the reminder on Telegram.
- Billing handoff: when Eric's Customer agent calls `createHandoffCard` with `toSkill: "nudger"`, fill the latest known invoice for that contact. If there is none, make a note card for the owner that states no amount.

**You need:** Eric's Telegram channel and thread work merged.

**Files:** `lib/domain/contacts.ts`, `lib/server/handoff.ts`.

**Run:**
```bash
npx vitest run lib/domain/contacts.test.ts lib/server/handoff.test.ts
```

**Time:** 30 min.

---

## Running 3 agents

Give each agent its own git worktree off `bookkeeping-agent` so they don't edit the same checkout:

```bash
git worktree add ../bk-a -b bookkeeping-agent-a bookkeeping-agent
git worktree add ../bk-b -b bookkeeping-agent-b bookkeeping-agent
git worktree add ../bk-c -b bookkeeping-agent-c bookkeeping-agent
# in each: cp ../Anchored/.env.local . && npm ci
```

Merge each back into `bookkeeping-agent` when its phase is done.

| Phase | Agent A | Agent B | Agent C | Wall time |
| --- | --- | --- | --- | --- |
| 1 | BK1 invoice rules | BK2 migration and Store | BK9 Price Watch | about 45 min |
| 2 (after merging phase 1) | BK3 + BK4 wiring | BK5 wording + BK6 delivery | BK8 CSV parser (pure part) | about 45 min |
| 3 (after merging phase 2) | BK7 chat input | BK8 route | BK10 page data | about 60 min |
| 4 | BK11 after Eric lands | | | 30 min |

That's about **2.5 to 3 hours** of wall time, plus your review and the merges. Phase 3 touches the shared `requests.ts`, `schemas.ts` and `middleware.ts`, so merge agent B and C changes one at a time.

---

## Testing the whole agent

### Unit tests (no keys)

```bash
npx vitest run lib/domain/invoices.test.ts lib/domain/invoice-csv.test.ts lib/domain/cards.test.ts lib/domain/requests.test.ts
npx vitest run lib/store/memory.test.ts lib/server/ingest.test.ts lib/server/supplier-invoice.test.ts lib/server/data.test.ts
npx vitest run lib/architecture.test.ts
```

### Manual run, AI off then on

```bash
ANCHORED_ALLOW_MEMORY_STORE=1 npm run dev -- -p 3102
```

1. Continue as a guest and open your sample business.
2. In Chat, type `Sam Lee owes $240 on invoice 1042, due Oct 20`. Approvals shows a reminder with $240 and #1042.
3. Type the same thing twice more. There are still only two reminders.
4. Type `Sam paid 1042`. The pending reminders are skipped.
5. Type `Sam owes money`. Anchored asks how much, and makes no card.
6. Simulator: send `invoice` with `{"supplier":"Sysco","item":"Chicken thighs","oldPrice":2.10,"newPrice":2.50}`. A Price Watch card appears.
7. Approve a reminder, then run dispatch with `curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/dispatch`. It's sent by email, or marked for the owner to send.
8. Set `AI_DAILY_CALL_CAP=0` and repeat steps 2 to 4. Template drafts appear with the same numbers.

### Sample data

The test business is Brightpath Coaching. Its full persona, invoice sheet and expected results are in `bookkeeping/coaching-persona.md`.

### Onboarding answers for Brightpath Coaching

Paste each answer when onboarding asks. Copy only the text inside the gray blocks.

**1. Start**
```
Brightpath Coaching, a career coaching agency in College Park
```

**2. What do you sell, who buys it, and roughly what does it cost?**
```
We sell 1-on-1 career coaching to early and mid-career professionals in the DC area. A single coaching session is $175, interview prep (2 sessions) is $300, a career coaching package (3 sessions) is $450, a leadership workshop seat is $600, and an executive coaching retainer is $1,200 a month. Most clients are referred or find us on LinkedIn.
```

**3. How do customers usually reach you? Pick all that apply.**

Pick: Email, Social media / DMs, Website form, Referrals / word of mouth. Leave walk-ins, phone calls and texts off. If it wants text:
```
Email, LinkedIn messages, the booking form on our website, and referrals from past clients. We don't get walk-ins or phone calls, and we don't buy from suppliers.
```

**4. What tools do you use?**
```
Google Workspace (Gmail and Google Sheets), Calendly for booking, Zoom for sessions. We track invoices in a Google Sheet.
```

**5. True for you (tap to add or remove)**

Turn on: Customers book appointments or tables, I sell plans or memberships, I post or advertise regularly. Turn off: I buy from suppliers or wholesalers. Leave quotes, shifts, catering, SNAP/EBT and licenses off. Then tap Done.

**6. What eats your week?**
```
Chasing clients who pay their invoices late, following up on new leads from LinkedIn and email, and reminding clients about upcoming sessions.
```
If it shows options, pick chasing unpaid invoices, following up with leads, and appointment reminders.

**7. Paste or type a reply you've sent a customer, so drafts sound like you.**
```
Hi Maya, thanks for reaching out! I'd love to help you get ready for your interviews. I have openings Tuesday at 10 a.m. or Thursday at 2 p.m. this week. Let me know which works best and I'll send a Calendly link. Looking forward to working with you! Best, Priya at Brightpath Coaching
```

**8. Languages**
```
English
```

**9. How do you get paid, or what's slow or annoying?** (if asked)
```
We send invoices by email and track them in a Google Sheet. Clients pay by Zelle or card link, usually within 14 days. A few clients pay late every month and I forget to follow up, so chasing unpaid invoices takes a lot of my time.
```

**10. Team size or hours?** (if asked)
```
It's just me plus one part-time coach. We work weekdays 9 a.m. to 6 p.m. Eastern.
```

**If a field comes out wrong,** fix it after onboarding by typing in Chat:
```
We sell 1-on-1 career coaching: single sessions $175, interview prep $300, a 3-session package $450, workshop seats $600, and a $1,200 a month executive retainer.
```
```
Customers reach us by email, LinkedIn messages, our website booking form, and referrals. Not by phone.
```
```
We don't buy from suppliers.
```

**After onboarding:** in Workflows, set the payment reminders workflow to "Anchored drafts it", then run the chat and sheet tests in `bookkeeping/coaching-persona.md`.

### Before the PR

```bash
git fetch origin && git merge origin/main
npm run check
git push -u origin bookkeeping-agent
```

Then open a PR following `.claude/skills/land-a-pr/SKILL.md`.
