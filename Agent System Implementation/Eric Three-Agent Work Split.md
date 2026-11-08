# Eric's three-agent work split

Current implementation status: see [Eric remaining implementation checkpoint](./Eric%20Remaining%20Implementation.md). Its November 8 decisions and verification distinguish completed code from teammate and live-deployment gates. Historical unchecked task lists below are not the current progress tracker.


Revised November 8, 2026 after Eric and Pramukh agreed to divide execution by product agent.

## Settled ownership

| Product agent or responsibility | Owner |
| --- | --- |
| Product agent 1: Customer | Eric, including backend execution, data extensions, integrations, send authorization and UI |
| Product agent 4: Internal Communications | Eric, including backend execution, triage, handoffs, brief/renewal jobs and UI |
| Product agent 2: Bookkeeping | Pramukh, including invoice/payment truth, reminder/cancellation policy and supplier extraction |
| Product agent 3: Marketing | Pramukh, including content/review policy, triggers, scheduling and review retention |
| Existing owner-facing app presentation, documentation and demo | Eric, preserving the app structure and single Approvals queue |

This revision replaces the earlier three-frontend-worker assignment and its blanket exclusion of backend work. Eric's workers are now **Customer execution**, **Internal Communications execution**, and **UI integration**. Worker numbers below refer to implementation workers, not the four product agent numbers. Pramukh owns shared agent groundwork, helper and shared Ask delivery, and cron/environment configuration. Eric's root coordinator handles Eric's extensions and serializes his three workers through the shared-file writer slots.

## Verified starting point

Worktree: `/Users/ericwei/Anchored/.claude/worktrees/eric-agent-dashboard`.
Branch: `feat/agent-dashboard`. Verified local checkpoint: `987f690`.
Detailed execution checklist: `Eric Agent System Implementation Plan.md`, execution stages 13-20. Stages 0-12 retain the original presentation checklist.

The following frontend milestone exists. Extend it rather than rebuild it:

- Active-agent workspace routes use the existing Workflows directory; old automation URLs, map, top-level navigation and single Approvals queue are preserved.
- Customer combines legacy Front Desk/Follow-up only in presentation. The canonical domain/data migration is still required, including niche/legacy compatibility.
- Navigation, Overview entry points, draft previews and recent activity use existing domain/feed reads.
- Scoped ChatWindow, CustomerThreads, TelegramSetup, AcknowledgmentRule and BriefRunButton are prepared and tested. Their new execution-dependent capabilities are not yet connected in production. These are now Eric's backend responsibilities, not work deferred wholesale to Pramukh.
- Approval/copy races, replaced-draft labels, history deep links, malformed hashes and onboarding/chat StrictMode handling have regression coverage.
- The checkpoint passed Node 26 `npm run check`: 101 test files, 1,189 tests and a production build. That pass does not verify future execution changes.
- Browser checks covered 12 pages at 1440, 1024, 768 and 390px with no document overflow or page exceptions, plus navigation, active Bookkeeping selection and workspace-to-card links.
- Automatic approval review rejected the browser's Approve: Send email click because it could contact a customer. It was not performed. Automated approval tests passed; external delivery/browser approval remains unverified. Do not retry that rejected action through a different tool.

## Shared context every worker must know

Anchored is a layered Next.js app, not four independent services. Read `AGENTS.md`, `docs/architecture.md`, `docs/security.md`, the system design and the revised implementation plan before adding cross-folder imports or new modules. Product agents coordinate through business records, events, contacts, threads, cards and the outbox. The model writes checked text; code decides skills, actions, recipients and sends.

- Customer owns Inquiry, Callback, Show-up Keeper, Catering, Closer, Call Follow-up, Debrief, Reactivator, Keeper, Referral Ask and Review Asker. Route only to chosen skills; niche ownership remains valid.
- Internal owns Inbox Triage, Daily Brief and License Clerk. It runs for every business and never sends to customers or moves money.
- Telegram uses one shared bot with one public link per business. Guests can use their own business link; the shared example remains read-only. Missed calls stay simulated; forwarded customer emails stay one-off cards.
- `decideCard` remains the only outbox writer; `dispatch.ts` remains the only sender. `checkSend` runs before queueing and at dispatch. `updatePendingCard` protects concurrent decisions and rewrites.
- Acknowledgment is the only standing business-reply rule in v1, starts off, uses fixed text and no model, and needs recorded owner authorization. STOP, consent, allergy locks and quiet hours still apply.
- All model calls use `getBudgetedLlm`. Mark customer/email text as data, check output and fall back to templates. Never put provider secrets in the browser.
- All ordinary Store methods take/filter session. Global hook/chat/due-work lookups require narrow documented exceptions that return the owning session. Add methods to interface, memory, Supabase, reset and tests together, with append-only migrations and RLS.
- There is currently no Telegram transport/thread persistence, no event-list read for brief snapshots, no persisted scheduled brief and no structured renewal calendar. These need implementation; UI fixtures do not supply them.
- Shared send safety changes, canonical ids, handoff keys, scheduling and financial/event semantics affect Pramukh's agents too. Use the shared writer; do not independently rewrite those systems.

## Operating agreement and foundation sequence

Use three workers plus one root coordinator. Proposed branches are `feat/customer-execution`, `feat/internal-execution`, and `feat/agent-ui-integration`. Each uses its own worktree/port from the verified local checkpoint, then adopts the shared foundation contract checkpoint. Preserve the original app layout and existing unrelated features.

Before execution edits resume:

1. Confirm with Pramukh who writes each shared file. Use V2's explicit split: Pramukh lands canonical ids/characters, parent-key persistence and createHandoffCard first, and owns shared validated Ask, vercel.json and .env.example. Eric owns Customer/Internal extensions. Assign one writer per subsequent shared-file patch and record the handoff; additive changes are not permission for simultaneous writes.
2. Freeze types for Customer threads/contact state, Telegram update/work claims and bindings, rule authorization, handoff parent/child ids, brief snapshots/runs, renewal facts, invoice-paid/job-complete events and Marketing flags.
3. Freeze minimal Store/query signatures and endpoint schemas. Workers can immediately build focused modules and tests against those written contracts. Pramukh supplies the groundwork checkpoint; Eric's coordinator merges it with `987f690`, integrates Eric's data extensions and publishes the combined checkpoint. Policy/tests can proceed against frozen seams before that merge.
4. Keep shared-file patches queued to the coordinator. No worker edits the Store, shared API schema, ingest or dispatcher concurrently with another worker or Pramukh.

Workers do not have to wait for each other's feature implementation. Live integration does require the shared foundation and relevant peer contracts; do not promise three isolated features can bypass those dependencies.

## Worker 1: Customer execution

Purpose: implement product agent 1 end to end, exposing stable reads/actions for Worker 3.

### Owned feature files and tests

Proposed new names, subject to checking the implementation tree before creation:

- `lib/connectors/telegram.ts` and its fake-fetch tests.
- `app/api/hooks/telegram/route.ts` and dedicated route tests.
- Pure Customer/thread policy under `lib/domain/threads.ts`, `customer-routing.ts` and `customer-timers.ts`.
- `lib/server/customer-reply.ts`, `telegram-hooks.ts`, `customer-timers.ts` and colocated tests.
- Customer-only thread/read, standing-rule and message-delete route handlers under `app/api/businesses/[id]/`, after the coordinator freezes their schemas. Do not add a duplicate endpoint if one already covers the operation.

Worker 3 owns the corresponding React components and pages. The coordinator owns Eric's contact/schema/store/safety/dispatch extension patches within single-writer slots and coordinates Pramukh's optional-agent integration in the existing business-chat route/handler.

### Implementation checklist

1. Implement Telegram update parsing, secret verification, plain-text sendMessage, safe inline URL buttons, provider-id/error handling and deleteMessage.
2. Implement authenticated webhook handling, durable atomic update claims, per-chat/business limits and safe retry/crash recovery. Return a quick 200 only after durable acceptance, never before a detached serverless promise finishes essential work.
3. Implement random per-business hook ids, existing-business backfill, `/start` binding to the latest business, scoped Telegram-only contacts, consent records and lossless chat ids. Define unbound messages and malformed hooks explicitly.
4. Persist `/stop` and blocked-bot updates before other work. Decide restart/rebind/queued-old-business behavior and bot-wide versus business-scoped STOP suppression with the coordinator. Retain scoped histories and ensure an older queued binding cannot bypass the latest selection or stop choice.
5. Reconcile `/start` protocol confirmations with centralized send authorization. Webhooks do not call sendMessage directly or introduce another free-text auto-reply rule.
6. Route from structured quote/booking/catering state with deterministic precedence and chosen-skill filtering. Billing questions create a linked Bookkeeping handoff or an owner note if no eligible receiver exists.
7. Draft using approved profile/event facts and the last 10 authorized thread messages. Apply Customer character within owner voice, budget the model, validate facts/numbers/links/times/allergens/placeholders and use checked template fallback.
8. Persist allergy locks, source/card/message relationships and state transitions. Define what happens to pending or queued replies when another customer turn arrives. Do not erase history or revive superseded drafts.
9. Implement selected-skill timers/follow-ups from recorded dates/status, with per-contact/job dedupe and response/completion/STOP cancellation. Missed calls remain simulator-only; never guess appointment slots from demo templates.
10. Implement default-off fixed acknowledgment authorization and its idempotency/frequency/revocation semantics through Eric's centralized decision-path extension, under its shared-file writer slot. No model call and no quiet-hours bypass.
11. Supply Telegram delivery planning, recipient-binding checks and outgoing-thread updates to the one dispatcher. Handle concurrent claims, provider failures and uncertain send outcomes without pretending remote exactly-once delivery.
12. Implement authorized message-deletion eligibility/results and bounded customer-thread reads, plus declared guest/example capabilities. Expose actual saved rule state and readable recipient names.
13. Supply Customer scoped-Ask policy to the shared business-chat integration. The server validates agent, chosen skill and recipient; general Chat and intake remain compatible.
14. Consume Pramukh's typed paid-invoice/finished-job event for a deduped Review Asker follow-on. Pramukh owns payment truth and reminder cancellation, not this Customer action.

### Tests and handoff

Cover invalid secrets, duplicate/concurrent/retried updates, crash recovery, cross-session reads, latest `/start`, unbound chat, Telegram-only identity, STOP/block/restart, stale queued binding, all routing branches, inactive/niche skills, malicious text, invalid facts and fallback, locks, timers, rule authorization/revocation, quiet hours, double decisions, delivery uncertainty and deletion isolation.

Export typed handlers, read/results and capability semantics for the coordinator/Worker 3. List required shared patches and configuration without editing another owner's files. Done means real Customer execution passes tests and can be integrated, not just that its view renders.

## Worker 2: Internal Communications execution

Purpose: implement product agent 4 end to end, including owner-only triage, brief and renewals.

### Owned feature files and tests

- Pure policy in `lib/domain/triage.ts`, the existing `lib/domain/brief.ts` and proposed `lib/domain/renewals.ts`.
- `lib/server/triage.ts`, `brief.ts`, `renewals.ts` and colocated tests.
- `app/api/hooks/email/route.ts` and dedicated tests for the authenticated Internal entry. Preserve the current secret check and source parsing.
- Brief read/Run now route handlers and a dedicated protected Internal cron route, with exact paths selected in the shared contract. Eric's cron-dispatch additions use the shared-file writer slot; Pramukh owns deployment schedule configuration.

The coordinator serializes Eric's shared email/hooks/Store/profile extensions. Pramukh supplies handoff/card groundwork, supplier helpers, shared business-chat integration and deployment scheduler configuration. Worker 3 owns brief/triage UI.

### Implementation checklist

1. Preserve Internal always-on policy and enforce no customer sends in executable card/channel/decision rules. Its character text alone is not a safety control.
2. Authenticate forwarded Postmark email before any lookup, bound parsed text, ignore attachments in this iteration, dedupe provider identity and preserve scoped source events.
3. Implement safe triage categories and rules fallback. Optional model suggestions are restricted to allowed active targets and grounded fields; code chooses the receiving skill.
4. Create one-off Customer cards for customer emails, linked Bookkeeping/Marketing handoffs for their work, and owner notes for unknown, uncertain or inactive targets. Do not merge forwarded email into Telegram threads or send a customer response.
5. Create idempotent parent/child card relationships and preserve provenance, identifiers and flags. Prevent repeated email/handoff processing from creating duplicate cards or loops.
6. Expose Internal request behavior to scoped Ask through the coordinator. Run brief/triage/renewal work only through allowed code paths; unsupported requests get a clear response, never a customer-send action.
7. Specify the event/snapshot reads the existing Store lacks. Build a code-computed snapshot of pending work/stake, actual sent/queued/copied outcomes since the last successful run, STOP changes, safety/review flags, events without cards and renewal notices.
8. Rank and dedupe in code. Exclude sample dollars, do not count one invoice across several reminder cards or a parent and child twice, preserve every safety flag, and consume Pramukh's trusted invoice/review facts instead of deriving them from message text.
9. Persist brief run identity, bounded snapshot, successful watermark and next-due state. Claim concurrent manual/cron runs atomically; failures do not advance the watermark or lose events. Repeated calls must not duplicate owner cards.
10. Optional model prose may only use snapshot facts/numbers and cannot hide flags. Use deterministic fallback when output fails validation or the provider/budget is unavailable.
11. Implement session-authorized Run now/read APIs and cron bearer verification, bounded due-business batches, timezone/default/local-day/DST rules and retry behavior. Overview and Internal page consume the same snapshot.
12. Specify structured, evidenced license/renewal dates and warning windows for the coordinator's profile migration. Implement warning boundaries, missing/invalid facts, completion/date changes and one reminder per license/window. No auto-renewal, filing or payment.
13. Keep owner Telegram brief notifications stretch-only. Coordinate scheduling so Customer timers, Internal jobs, the sole dispatcher and Pramukh's Marketing tick are not run twice by competing cron routes.

### Tests and handoff

Cover invalid/repeated email hooks, prompt injection, active-target validation, fallback owner notes, handoff races/loops, no customer outbox entries, cross-tenant snapshot reads, empty/mixed activity, duplicate financial facts/sample exclusion, model-added numbers/omitted flags, cron/manual overlap, watermark recovery, timezone/DST, renewal boundaries/completion and no-AI operation.

Export snapshot/job/request handlers and stable response types for Worker 3. Supply shared-store/profile/migration needs to the coordinator. Done means real owner-only jobs and APIs work with durable state, not a generated paragraph without a run record.

## Worker 3: UI integration, approvals and demo

Purpose: finish Eric's existing presentation work against workers 1 and 2's implemented contracts, preserving all delivered behavior.

### Owned files and tests

- `app/app/b/[id]/workflows/[workflow]/page.tsx`, its loading/error/page tests; preserve the nested automation page and URL meaning.
- `app/app/b/[id]/connections/**`, `approvals/**`, and the Overview `page.tsx`/test.
- `components/business/agents/AgentWorkspace.tsx`, `CustomerThreads.tsx`, `BriefRunButton.tsx`, their tests and feature CSS.
- `components/chat/ChatWindow.tsx`, its tests, starters and chat CSS.
- `components/connections/**` for owner controls/contact presentation and colocated tests/CSS.
- `components/business/AgentCard.tsx`, `handoff.ts`, `SendYourself.tsx`, `OpenFromHash.tsx` and tests.
- Feature-local browser API adapters, `README.md` and `Agent System Implementation/Eric Agent Demo Walkthrough.md`.

### Implementation checklist

1. Use the delivered pages/components. Preserve general Chat/intake request compatibility, StrictMode behavior, old automation URLs, niche agents, map/compare/adopt flow and the single queue.
2. Replace provisional display contracts with actual Customer/Internal API projections; call exact agreed endpoints through the existing API helpers. Never pass ordinary server functions across client callback props or treat client flags as authorization.
3. Wire thread selection/history/locks/STOP and actual delivery states, real test links for guest-owned businesses, saved acknowledgment approval, scoped Ask and brief Run now/snapshot. Remove unavailable messages only when capability works.
4. Generate a real QR locally once the coordinator owns/selects the package/lockfile change. No external QR service or fake QR. Preserve safe external links and clipboard recovery.
5. Preserve approval/copy race guards, replaced labels, exact edited text, hash disclosure links, truthful approved/queued/sent/copied wording and no personal-app fallback for Telegram.
6. Add rule provenance and deletion controls only from real server authorization/eligibility; do not decide provider windows or cancellation policy in React.
7. Keep Overview/brief counts from Worker 2's one snapshot, not independent browser financial sums. Preserve last successful data on errors, narrow layouts, keyboard access, business-switch isolation and missing/empty/error distinctions.
8. Provide existing Bookkeeping/Marketing presentation for Pramukh's real results without implementing his policy or pretending direct social publication.
9. Update README/demo to what is actually implemented. Record UI, simulator, fake-provider and real-provider evidence separately. Do not claim a finished video or live send before verification.

### Tests and handoff

Cover adapter method/body/error behavior at fetch, query and Back/Forward selection, stale requests, guest/example permissions, unsupported agent requests, acknowledgment saved state, brief failures, copy/decision failures, replaced cards, Telegram delivery/recovery/deletion states and responsive/a11y regressions.

Done means real UI wiring is correct where contracts exist, unsupported capabilities remain truthful, and no server logic moved into components. Worker 3 can continue fixtures/behavior/accessibility testing without waiting on workers 1 and 2's implementation.

## Shared infrastructure and coordinator boundaries

Pramukh owns the first groundwork PR, lib/domain/agents.ts, shared handoff/supplier helpers, Bookkeeping/Marketing execution, validated shared Ask, vercel.json and .env.example. Eric owns his execution extensions and UI. The paths below are coordination surfaces, not a grant of all backend files to Eric. Record one writer per patch and never edit a shared orchestrator concurrently. Pramukh owns domain cards except Eric's triage/brief templates; the single-file slot still applies.

- `lib/domain/types.ts`, `agents.ts`, `paths.ts`, `cards.ts`, `requests.ts`, `plan.ts`, `contacts.ts`, `executor.ts`, and profile field/detail registries. Add canonical ids/characters, selected-skill/Ask policy, channel/consent/rule/thread/handoff/renewal types and send gates here once.
- `lib/api/contract.ts`, `schemas.ts`, aggregate agent/capability reads and shared existing business-chat routes/handler. Keep request schemas and types aligned.
- `lib/store/types.ts`, `memory.ts`, `supabase.ts`, shared store tests and new migrations. Add interfaces/queries/atomic claims and both implementations together; enable RLS, indexes, reset and retention. Assign nonoverlapping migration timestamps before either teammate adds a file.
- `lib/server/ingest.ts`, `hooks.ts`, `decide.ts`, `dispatch.ts`, `data.ts`, `create-business.ts`, `business-chat.ts` and shared model-validation helpers. Keep orchestration thin; call workers' focused modules and Pramukh's handlers.
- Shared email connector, current cron dispatch route, `middleware.ts`, scheduler configuration and environment examples. Preserve the one sender, verify/rate-limit entry points and document deployment-wide query exceptions.
- `components/routes.ts`, shell data/location/navigation, `view-model.ts`, base fixtures, agent labels/view helpers and their shared tests. Retain current compatibility until backend migration is safe.
- Existing `components/site/**` and workflow compatibility, `app/globals.css`, package/lockfile, shared test/build configuration, architecture/security docs and the integration/assignment documents.

Coordinator responsibilities are implementation work, not just review: consume Pramukh's groundwork, complete plan stage 13's Customer/Internal foundation extensions, safely integrate stages 14-18, resolve protocol notices/rule revocation/queue-binding semantics, and run the merged-tree checks. Do not widen a deployment-wide Store query without documenting its session boundary and tests.

## Contracts with Pramukh

| Boundary | Eric provides | Pramukh provides |
| --- | --- | --- |
| Billing question or forwarded supplier/overdue email | Validated parent/source, active-target selection, known contact/invoice linkage and idempotency key | Bookkeeping receiver, grounded amount/supplier extraction and its approval card/policy |
| Invoice paid / job complete | Customer follow-on consumer, Review Asker eligibility/deduplication and Internal reporting | Authoritative stable invoice/job/contact identifiers, payment/completion event, cancellation of pending/queued reminders and reminder status |
| Marketing/reviews | Validated triage handoff, shared contact/thread references and Internal flags/snapshot reporting | Review/post policy, generated draft/results, review flags, finished-job/weekly triggers and retention requirements |
| Telegram delivery | Shared adapter, consent/STOP/lock/quiet-hours gates and one dispatcher | Trusted Bookkeeping recipient/invoice data and use of the shared send path, never another sender |
| Store/scheduler changes | Customer/Internal Store patches, Telegram registration script and brief handler/cadence | Shared groundwork, vercel.json/.env.example, posts schedule and agent 2/3 query requirements; serialized shared patches |

Do not guess customer identity by name or amount, infer payment from prose, implement supplier/Marketing policy in triage, or let a paid event duplicate Customer follow-ons. If the other agent is inactive or its module is not integrated, return a clear owner note/pending integration result instead of silently executing a different action.

## Integration and finish gates

1. Confirm ownership and freeze contracts, then let workers develop focused modules/tests in parallel. Coordinator publishes shared foundation checkpoints; no worker silently changes frozen interfaces.
2. Integrate Customer and Internal modules through the shared ingest/decision/dispatch and scheduler. Connect UI only to implemented capabilities. Preserve both Store backends, guest access, legacy data and app structure.
3. Integrate Pramukh's Bookkeeping/Marketing exports/events, testing stubs first if his work is unfinished and actual merged behavior before declaring cross-agent completion.
4. Run pure policy, connector fake-fetch, migration/RLS, Store parity, webhook/idempotency/recovery, schema/rate-limit, job and UI tests. Then Node 26 `npm run check` on the merged tree, not just a worker's isolated branch.
5. Browser-check all preserved sections, four agent views, old URLs and widths. Verify the controlled real-provider start/message/draft/approval/delivery/rule/STOP/allergy path and triage/brief/renewal flows only under authorized test conditions. Do not bypass the previous automatic review rejection.
6. Follow the existing PR landing workflow with fresh main, migrations/environment notes and real test evidence. Merge only when instructed.

This is a planning/documentation revision. It does not start a new worker wave, implement backend code or claim the newly assigned execution is already complete.

## V2 consolidation details

Read the [consolidated design](./Anchored%20Agent%20System%20Design.md), [Pramuk tasks](./Pramuk%20Tasks.md) and [Eric tasks](./Eric%20Tasks.md). Pramukh provides `createHandoffCard`, `receiveSupplierInvoice`, agent 2/3 page/brief feeds and shared Ask integration; Worker 1 supplies Customer handlers and thread/flag helpers, Worker 2 supplies Internal handlers and the brief job, Worker 3 wires all screens. Helper signatures, null/no-handler results and idempotency source keys must be frozen before live integration. Pramukh's groundwork is a real integration dependency, not a reason to block isolated policy or fixture tests.

Migration reservations, subject to the actual newest main file: Pramukh `20261108000300_agent_groundwork.sql`, Eric `20261108000400_telegram_threads.sql`, Pramukh `20261108000500_bookkeeping.sql` and `20261108000600_marketing_reviews.sql`; later Internal schema gets a coordinated free slot. Groundwork must precede dependents. Existing draft `stake` persistence is verified, not duplicated blindly.

Eric sends cron/secret requirements to Pramukh, who owns vercel.json and .env.example. QR generation and live renewals remain in Eric's completion criteria unless scope is explicitly reduced. The existing [workflow] directory is retained; no app restructuring or route rename is authorized.
