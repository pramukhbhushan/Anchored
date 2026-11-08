# Pramuk's implementation tasks

Owner: Pramuk, called Pramukh in the V2 design. Updated November 8, 2026.

## Scope and starting context

You own shared agent groundwork, product agent 2 Bookkeeping, product agent 3 Marketing, shared validated agent Ask, and deployment cron/environment integration. Eric owns Customer, Internal Communications, all owner-facing pages/controls, Telegram transport and the demo. This document and the consolidated `Anchored Agent System Design.md` replace the older all-backend-to-one-person plan.

The verified frontend checkpoint is `987f690` on `feat/agent-dashboard`. It contains agent pages, navigation, current feed previews and tested but unconnected future controls. Do not rebuild that UI or treat those controls as proof of working execution. Original architecture baseline was PR #45. Remote main has not been refreshed successfully because of SSH authentication; refresh before landing.

Read AGENTS.md, docs/architecture.md, docs/security.md and the landing workflow. Use Node 26, a separate branch/worktree and unused port, and preserve the app structure. The model writes checked words; code chooses actions/recipients/skills. Only the central decision path writes outbox entries; only the dispatcher sends, with checkSend at both gates.

## 1. Agree interfaces and land shared groundwork first

- [ ] Freeze canonical ids `customer`, `books`, `content`, `internal` plus niche ids, enabled-skill/character shapes, parent/source/contact/invoice/job identifiers, event idempotency keys, result/error types and query contracts with Eric.
- [ ] Merge Front Desk/Follow-up at the domain level while retaining all 19 skills and niche precedence. Handle saved profiles, cards, crew decisions, conversation ownership and legacy ids compatibly. Do not just rename displayed labels or lose old customer history.
- [ ] Add role/voice/never character metadata for all core agents. Character applies where text is generated; executable policy enforces hard limits. Preserve owner voice and checked templates.
- [ ] Add parent-key handoff persistence and verify existing stake persistence. Stake already exists on domain/API drafts and serialized cards; do not create duplicate fields blindly.
- [ ] Implement `lib/server/handoff.ts` and `createHandoffCard(session, business, {toSkill,parentKey,contactId,facts,...sourceIdentity})`. Agree the exact signature. Validate chosen skill/active target and session ownership, ground facts, create stable parent/child links and dedupe retries. Return card key or the agreed no-handler result; never send from this helper.
- [ ] Put new Store operations in types.ts, memory.ts and supabase.ts with tests, reset, indexes, RLS and retention coverage. Declare narrow global-query exceptions explicitly rather than removing session filters.
- [ ] Test migration/legacy compatibility, inactive/niche targets, duplicate/concurrent handoffs, invalid parent/contact ownership, amount provenance and no outbox side effect.
- [ ] Land one small groundwork PR and give Eric the commit, schemas/helper exports and compatibility notes. Eric merges it into his existing UI checkpoint. Eric's focused policy/fixture tests may run before the PR, but live integration depends on it.

## 2. Implement Bookkeeping

Main surfaces: `lib/connectors/stripe.ts`, `app/api/hooks/stripe/**`, focused Bookkeeping/supplier modules and their tests. Shared ingest, Store, safety and dispatch edits use the single-writer slot.

- [ ] Preserve Stripe signature verification before any lookup/write. Resolve the business by authenticated hook identity, then use that owning session. Bound/validate event payloads and dedupe provider event ids; handle retry, concurrency and incomplete processing.
- [ ] Read overdue/payment-failed and paid invoice events from trusted Stripe data. Preserve stable event/invoice/job/contact identity, currency, amount and state; never match an invoice to a customer by name or amount alone.
- [ ] Draft Payment Nudger from actual invoice amount/number. No invented fee, threat or money movement. Every reminder needs approval, including Telegram delivery.
- [ ] Enforce at most two reminders per invoice in code across repeated events, concurrent jobs and send outcomes. Define which statuses consume the limit and avoid duplicate scheduled/pending cards.
- [ ] On payment, update invoice state and atomically suppress pending reminders and queued outbox work for that invoice. Recheck current paid state at approval/dispatch through the shared path. Define behavior for an already-sending or already-sent reminder; do not claim it can be recalled.
- [ ] Emit a typed, idempotent invoice-paid/job-complete result for Eric's Customer Review Asker and Internal reporting. Payment alone must not invent job completion if that relationship is unknown.
- [ ] Implement `lib/server/supplier-invoice.ts` and `receiveSupplierInvoice(session,business,email)` for Eric's triage. Ground supplier/item/prices in the email, validate structured output/numbers, compare only compatible observed facts and currencies/units, and fall back safely on missing facts.
- [ ] Price Watch reports a checked increase and stake without fabricating a prior price, negotiating, purchasing or changing a bill. Define when the supplier helper returns no card and how the caller reports that outcome.
- [ ] Use Eric's shared Telegram delivery when a verified linked contact/chat exists; otherwise use configured email or the supported owner handoff. A chat id is not inferred from an email. STOP, consent, locks and quiet hours use the same executor; never add another sender.
- [ ] Preserve signed-in-only secret setup and the guest invoice-late simulator. Label simulated facts separately from real Stripe records.
- [ ] Test signed/invalid/replayed webhooks, wrong tenant, trusted amounts, missing identities, payment races, two-reminder boundaries, paid-after-approval cancellation, supplier extraction attacks, no checked change, no-AI/budget fallback and channel choice.

## 3. Implement Marketing

Main surfaces: `lib/server/posts.ts`, `lib/domain/posts.ts`, `lib/domain/reviews.ts`, `app/api/cron/posts/**`, content/review templates and retention migration.

- [ ] Implement selected-skill Post Drafter and Review Drafter behavior. Always require owner approval for public content; do not use the acknowledgment standing rule for Marketing.
- [ ] Generate post ideas from actual profile services/offers, finished jobs and eligible thread context. Use Eric's thread read interface; exclude STOP contacts and avoid customer names/details without permission. Never invent prices, awards, guarantees, discounts or outcomes.
- [ ] Implement weekly and finished-job triggers with stable business/window/job idempotency, chosen-skill checks, timezone-aware due work, overlap control and failure recovery. No duplicate posts from cron plus a repeated event.
- [ ] Authenticate the posts cron route and rate-limit public mutations. Use bounded due-business reads with narrow documented session exceptions. Coordinate cadence once in vercel.json.
- [ ] Accept pasted/simulated/triaged reviews, validate text and actual source identity, draft grounded calm responses, flag concerning reviews, and never argue or offer compensation for a rating.
- [ ] Flag a customer's thread through Eric's scoped flag helper only when the association is real. Unmatched reviews remain owner flags, not guesses about a person's visit.
- [ ] Coordinate Review Asker versus Review Drafter so the same review/customer is not contacted twice. Eric owns asking; you own replying/public content. Use explicit review/job ids and idempotency semantics.
- [ ] Output approved drafts on the list/copy path, with safe destination metadata for Eric's existing copy UI. Google/Meta publishing and new platform integrations remain deferred. Copied is not published or remotely delivered.
- [ ] Purge review text within 30 days for every session, including signed-in accounts, not only expired guest businesses. Cover events, cards, thread flags, snapshots and derived retained copies without deleting unrelated audit/customer records. Test reset and purge behavior.
- [ ] Test trigger replay/concurrency, active-skill filtering, fact/identity leakage, invalid model output and template fallback, negative-review flags, no incentive language, no automatic publication and account/guest retention boundaries.

## 4. Provide reads, Ask and cross-agent feeds

- [ ] Provide Bookkeeping/Marketing page reads and code-computed brief/Overview feeds: overdue totals, invoice reminder/cancellation outcomes, supplier increases, pending posts/replies and review flags. Return stable ids, time window and statuses so Eric cannot double count one invoice or a parent/child handoff.
- [ ] Implement shared optional-agent Ask validation in the existing business-chat contract/handler. General Chat still accepts text-only requests and intake remains unchanged. Validate active agent, chosen skills, allowed request and recipient server side; code picks the skill, model writes checked words only.
- [ ] Integrate Eric's typed Customer/Internal request handlers, your own handlers and no-handler fallback. Shared owner Chat remains distinct from customer Telegram history. Untrusted prompts cannot select arbitrary actions or bypass approval.
- [ ] Coordinate production API schemas/contracts and rate-limit mappings additively with one writer per file. Do not add a second endpoint with slightly different semantics for the same operation.
- [ ] Test unknown/inactive agent, unsupported skill, cross-business recipient, malformed request, no-AI operation, sample exclusion and agreement between returned feed numbers and actual records.

## 5. Configuration, migration and shared-file delivery

- [ ] Own vercel.json and .env.example. Include Eric's brief cron entry and your posts entry, preserve the sole dispatch schedule, and avoid duplicate scheduling of Customer timers/Internal renewal passes. Eric supplies exact handler paths/cadence and Telegram environment requirements.
- [ ] Document Telegram token/username/webhook secret, cron bearer, connector key, email and existing provider settings with empty example values only. Secrets never use NEXT_PUBLIC_ or appear in logs. Eric supplies/owns the Telegram registration script; coordinate deployment ordering.
- [ ] Verify the actual plan supports the intended scheduler frequency; document an external protected trigger if needed rather than assume a plan capability.
- [ ] Proposed checkpoint slots: your shared groundwork `20261108000300_agent_groundwork.sql`, Eric Telegram `20261108000400_telegram_threads.sql`, your books `20261108000500_bookkeeping.sql`, your reviews `20261108000600_marketing_reviews.sql`. Confirm against fresh main before creating files; reserve later Internal schema with Eric. Never edit/rename merged migrations or let a dependent file sort first.
- [ ] Own lib/domain/agents.ts and cards.ts except Eric's triage/brief templates; own domain demo cases. A shared file still has only one writer at a time. Announcing an additive change is not permission for concurrent rewrites.
- [ ] Give Eric helper signatures, migration/commit ids, invoice/job events, feeds, Ask capability/error semantics, cron/environment notes and actual test evidence. Do not mark Telegram thread reads or Eric's brief job as implemented by your groundwork.

## 6. Finish and verification

- [ ] Test pure policies, connector fake-fetch, schema/rate limits, authenticated hooks, both Store backends, reset/RLS/migrations, cron claims/recovery and cross-agent contracts. No live keys are needed for the ordinary test/build suite.
- [ ] Integrate your work with Eric's preserved UI and shared Telegram gates; verify supplier/billing handoffs, paid-invoice cancellation and one Customer follow-on, Marketing flags and one Internal snapshot.
- [ ] Fetch/merge main, resolve conflicts preserving both intentions and pass Node 26 npm run check on that exact tree. Follow the existing PR template/landing workflow; include all new migration/environment prerequisites and no AI attribution. Merge only when instructed.
- [ ] Real provider tests use authorized controlled recipients. The earlier browser email-approval click was rejected by automatic review; do not retry or bypass it through another tool. Automated tests and actual delivery evidence remain separate.

Done means your groundwork and both execution agents work with session isolation, idempotent recovery, checked facts, shared sends, copy-only public content, retention, feeds/Ask/configuration and integrated tests. Eric's Customer/Internal/UI work is not transferred to you unless explicitly agreed.
