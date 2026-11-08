# Eric's implementation tasks

Current implementation status: see [Eric remaining implementation checkpoint](./Eric%20Remaining%20Implementation.md). Its November 8 decisions and verification distinguish completed code from teammate and live-deployment gates. Historical unchecked task lists below are not the current progress tracker.


Owner: Eric. Updated November 8, 2026.

## Scope, baseline and division

You own product agent 1 Customer, product agent 4 Internal Communications, all owner-facing dashboard/control work, Telegram transport, documentation and demo. Pramuk owns the canonical agent/character and handoff groundwork, Bookkeeping, Marketing, shared validated Ask, vercel.json and .env.example. Use the consolidated Anchored Agent System Design and the detailed Eric Agent System Implementation Plan, especially execution stages 13-20.

Preserve checkpoint 987f690 on feat/agent-dashboard in the existing implementation worktree. The UI has already passed typecheck, 1,189 tests and a build; agent routes/navigation and previews exist. New execution and most prepared future controls remain unconnected. Do not rebuild the app or claim the checkpoint proves live Telegram/brief execution.

## 1. Coordinate groundwork and shared contracts

- [ ] Agree exact helper, event, query/API shapes and one-writer slots with Pramuk. Consume his canonical Customer/character/legacy compatibility, parent-key persistence and createHandoffCard groundwork, then merge that commit into the existing UI branch. Isolated policy/fixture tests can proceed before live integration.
- [ ] Supply Customer/Internal data, authorization, message/thread/rule/handoff/brief-run/renewal needs. Use the agreed source/event/contact/invoice/job ids and idempotency keys; never guess identity from names or amounts.
- [ ] Use createHandoffCard for billing/triage and receiveSupplierInvoice for supplier material; consume Pramuk's books/Marketing feeds. Return owner notes or clear no-handler results for inactive/unsupported targets, never silently activate work.
- [ ] Provide typed Customer/Internal request handlers for Pramuk's shared optional-agent Ask. Retain text-only general Chat, onboarding, chosen-skill/niche behavior and server-validated recipients.
- [ ] Own Customer/Internal schema and Store extensions under single-writer slots: interface, memory, Supabase, tests, reset, RLS, indexes and retention together. Add bounded event reads and durable hook/chat/due-work lookups with narrow documented global exceptions returning the owning session.
- [ ] Respect migration dependency order. Proposed slots: Pramuk groundwork00300, Eric Telegram00400, Pramuk books00500/reviews00600 on November 8; confirm full filenames/timestamps against fresh main. Reserve subsequent Internal run/renewal schema. Parent-key groundwork must precede dependents; stake persistence already exists and is verified, not duplicated blindly.

## 2. Implement Customer identity and ingress

Main files include lib/connectors/telegram.ts, app/api/hooks/telegram/**, lib/server/telegram-hooks.ts, lib/domain/threads.ts, customer routing/timer modules, and Customer-only read/rule/delete routes. Extend shared ingest/create-business/contact/schema files serially, not with competing worker edits.

- [ ] Build fake-fetch-tested Telegram parsing, secret verification, plain-text sendMessage, safe inline URL buttons, deleteMessage, provider ids and errors. No parse mode, arbitrary model URLs or secrets in client props.
- [ ] Verify the webhook secret before lookup/write; bound payloads, support only intended updates and redact names/messages from logs.
- [ ] Claim update_id atomically with recoverable incomplete/failed/completed states. Append events/messages/cards once. A quick 200 requires durable acceptance; never rely on a detached serverless promise. Limit chat/business ingress before model calls.
- [ ] Generate random business hook ids and safe existing-business backfill; create public test URLs for guest-owned businesses, not a live shared example inbox. Support Telegram-only contacts without fabricated phone/email and store ids losslessly.
- [ ] Implement /start latest-business binding, explicit /stop, blocking, restart policy and unbound/invalid-hook behavior. Define bot-wide versus tenant suppression and stale queued-binding behavior; older work cannot bypass STOP or the latest chat selection.
- [ ] Resolve fixed /start protocol-confirmation authorization with the centralized send path. Do not introduce direct webhook sends or an extra free-text automatic-reply rule.
- [ ] Persist thread state, messages, source/card/provider ids, direction, skill, timestamps and real delivery status. Keep tenant histories isolated and owner Chat separate.

## 3. Implement Customer routing and work

- [ ] Code routes only among chosen skills: structured open quote to Closer, booking to Show-up Keeper, catering to Catering Responder, otherwise Inquiry. Define precedence and respect niche ownership. Billing hands off to Bookkeeping.
- [ ] Preserve all Customer skills: Inquiry, Callback, Show-up Keeper, Catering, Closer, Call Follow-up, Debrief, Reactivator, Keeper, Referral Ask and Review Asker. Timers use recorded dates/job states and deduped contact/window ids; no guessed open slots or prices.
- [ ] Draft from authorized profile/event facts and last 10 scoped thread messages. Delimit customer content as untrusted data, apply owner voice plus character, use getBudgetedLlm and reject unsupported numbers/prices/times/links/promises, allergy content, blanks or bad length. Use checked template fallback without AI or budget.
- [ ] Persist allergy locks before drafting/acknowledgment. Define lock release and newer-message behavior for pending/approved/queued replies; supersede only through atomic pending-card methods and retain history.
- [ ] Expose bounded/paged contacts/threads and real capabilities for the UI. Never treat failed reads as successful empty history or allow another session's selected contact.
- [ ] Consume authoritative paid/job-complete events for a deduped Review Asker follow-on. Pramuk owns payment truth, cancellation and completion linkage; you do not infer a completed job from an arbitrary paid invoice.
- [ ] Provide scoped thread reads and flagThread behavior for Marketing post ideas/review flags. Exclude stopped contacts from post ideas and identifying text without permission; unknown review/customer linkage stays an owner flag.

## 4. Implement authorization and Telegram delivery

- [ ] Acknowledgment starts off, is fixed text, has no model call and requires explicit saved authorization. Define per-event/window frequency, idempotency, audit fields and disable/revocation behavior for queued rows.
- [ ] Keep decideCard the only outbox writer, dispatch.ts the only sender and checkSend at queue and dispatch. Preserve updatePendingCard race protection. Extend Telegram consent/STOP/locks and quiet hours for Telegram/customer email; opt-out suffix remains SMS-only.
- [ ] Add Telegram delivery planning and provider calls inside the shared dispatcher. Recheck current binding, consent, STOP, lock, relevant invoice/context and rule authorization. Keep Bookkeeping on the same gate/sender.
- [ ] Atomically claim queued work, persist actual provider outcome/outgoing history and distinguish retryable/permanent/uncertain failure. Do not promise exactly-once remote delivery after an ambiguous provider acceptance/crash.
- [ ] Implement authorized deletion by stored message/outbox identity and actual provider window. Preserve audit history; report expired/already-deleted/provider failure truthfully and never claim deletion undoes reading.
- [ ] Build scripts/telegram-webhook.ts and Telegram setup documentation. Keep tokens server-only, register supported updates with the secret only in authorized deployment setup, and give Pramuk exact environment/cron requirements for his config files.

## 5. Implement Internal Communications

Main files include pure triage/brief/renewal policy, lib/server/triage.ts, brief.ts, renewals.ts, app/api/hooks/email/**, app/api/cron/brief/** and authorized brief read/Run now routes. Preserve existing email authentication/adapter behavior.

- [ ] Keep Internal always on and enforce owner-only/list behavior in code. It never messages customers, moves money, renews licenses or files anything automatically.
- [ ] Verify Postmark secret before lookup/write, bound text, ignore attachments for this iteration and dedupe provider email events. Preserve source/provenance with scoped session identity.
- [ ] Classify through deterministic allowed categories/active skills; optional model suggestions are validated grounded data, not action choices. Customer emails are one-off Customer cards; supplier/overdue and review material goes through Pramuk's helpers/receivers; unknown/inactive work becomes owner notes.
- [ ] Use stable parent/source keys and idempotent child cards to prevent duplicate handoffs and loops. Keep email out of Telegram history and do not send an automatic email response.
- [ ] Provide supported Internal request handlers for shared Ask; unsupported requests decline clearly. Model calls remain budgeted with rules fallback and untrusted text delimiters.
- [ ] Extend the existing pure brief helpers with a server snapshot of waiting cards/stake, sent/queued/copied outcomes since the last successful run, STOP changes, safety/review flags, events with no card and renewal notices.
- [ ] Obtain trustworthy Bookkeeping/Marketing facts from Pramuk's reads. Rank and dedupe in code, exclude sample dollars and avoid counting one invoice or parent/child relationship twice. Never infer payment from prose or let model wording add numbers/hide flags.
- [ ] Persist a brief run/snapshot/watermark/next-due state. Claim manual/cron overlap once; failed runs do not advance the watermark or lose events. Return one owner-only brief card with deterministic text fallback.
- [ ] Implement session-authorized brief reads/Run now with readBody/Zod/rate limits and CRON_SECRET-protected bounded scheduling. Document due-work global exceptions and business timezone/default/DST behavior.
- [ ] Add structured evidenced license/renewal dates, warning windows and completion state through profile registries/validation. Dedupe by license/window, handle invalid/missing dates, and stop/update reminders when facts change. Starter cards do not complete live scheduling.
- [ ] Give Pramuk brief handler/cadence requirements so vercel.json includes it exactly once alongside dispatch/posts; do not independently edit his scheduler config. Owner Telegram notifications remain stretch scope.

## 6. Finish all owner-facing UI

- [ ] Retain existing shell/top-level order, map, compare/adopt flow, old automation URLs and one Approvals queue. Keep agent pages in workflows/[workflow]/page.tsx with the existing nested automation route; no directory rename.
- [ ] Complete all four core/niche agent views, metadata/limits/voice, enabled skills, pending previews, handoff links and recent actual outcomes. Use canonical display labels and preserve legacy compatibility until the domain migration is integrated.
- [ ] Wire Customer selection/query Back/Forward, bounded history, STOP/allergy locks, delivery and stable approval anchors. No direct customer-send composer or client-side safety override.
- [ ] Wire optional scoped Ask only to real server support. Preserve general Chat/intake StrictMode, retries, duplicate suppression and isolation across business/agent changes.
- [ ] Show the real Telegram link on Customer/Connections for guest-owned businesses independently of secret-integration permissions; keep shared example read-only. Generate a genuine QR locally once dependency ownership is assigned; no fake QR/external image service.
- [ ] Show exact acknowledgment template before explicit approval, keep attempted/saved state separate, display authoritative permission/status, prevent repeated saves and preserve the saved state on failure.
- [ ] Wire Overview/Internal/Run now to one snapshot; retain last successful brief on failure. Keep Bookkeeping/Marketing presentation and copy destinations based on Pramuk's reads, not duplicated domain policy.
- [ ] Preserve truthful pending/approved/queued/sending/sent/failed/copied/replaced wording, rule provenance and deletion eligibility. Keep copy failure/approval race guards, exact edited text, disclosure/hash links and no SMS/mailto/private-chat fallback for Telegram.
- [ ] Use tokens/full width/container queries, one column on phones, safe plain text, accessible names/focus/status, and no cross-business stale state. Test empty/loading/unavailable/error and long/Unicode text states.

## 7. Tests, deployment integration and demo

- [ ] Test connector fake-fetch, signature/secret rejection, duplicate/update/claim recovery, latest binding and STOP/block/restart, chosen/niche routing, grounding/fallback, persistent locks, concurrent decisions, quiet-hour/rule revocation/paid-state races, uncertain sends and deletion isolation.
- [ ] Test Internal authenticated email/repeated handoffs, inactive targets, no customer outbox, code-only snapshot amounts/flags, manual/cron/watermark recovery, tenant boundaries, license windows/completion and timezone/DST.
- [ ] Verify every added Store method in both backends with reset/RLS/migrations and narrow global lookup tests. Keep ordinary tests/build key-free; new mutations get schema/readBody and middleware coverage.
- [ ] Run colocated fetch-boundary UI tests and production browser checks at desktop, narrow containers, collapsed/mobile shell and phone widths. Preserve the full existing app flow and compare/adopt behavior.
- [ ] Integrate Pramuk's groundwork, supplier/handoff helpers, Ask/feeds, authoritative paid/job events and Marketing flags, testing contracts first and actual merged behavior before declaring completion.
- [ ] In an authorized controlled test environment verify Telegram start/message/draft/owner approval/real delivery, default-off rule/save/revocation, quiet hours, STOP/block, allergy and failure, plus forwarded triage, paid cancellation/one follow-on, Marketing copy and brief/renewal behavior. Do not retry or bypass the prior automatically rejected browser email-approval action through another tool.
- [ ] Give Pramuk migration, route/cadence and secret-name prerequisites for deployment. You own README, actual setup/demo instructions, screenshots and the 10-minute video; label live versus simulated/unavailable accurately, redact customer data/secrets and do not claim a recorded video before it exists.
- [ ] Fetch/merge main and run Node 26 npm run check on the exact final tree, following the existing PR workflow, migration/env notes and Conventional Commits without AI attribution. Merge only when instructed.

Done means both owned execution agents and their persisted jobs/data/security paths work, the UI is connected without app restructuring, cross-agent contracts are integrated and evidence distinguishes automated tests from real provider delivery. Pramuk's Bookkeeping/Marketing execution and groundwork/configuration ownership are retained.

## Three-worker delegation

1. Customer execution: Telegram, thread routing/replies/timers, authorization/delivery/read interfaces.
2. Internal execution: triage/helper calls, brief snapshot/runs, renewals and related APIs.
3. UI integration: existing pages/Ask/controls/approvals/Overview, adapters, responsive QA and demo documentation.

Eric's root coordinator handles Eric's shared-file slots, integrates Pramuk's groundwork/configuration exports, and validates the combined result. The detailed file boundaries remain in Eric Three-Agent Work Split.md in the implementation worktree. No new implementation wave is dispatched by this task document.
