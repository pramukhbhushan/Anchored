# Eric's remaining implementation checkpoint

November 8, 2026. Working branch: `eric-design-testing`. This checkpoint reconciles `MD_files/Eric Execution Stages.md` and `MD_files/Eric Remaining Work Handoff.md` with the integrated current frontend. The original files remain historical inputs. Main's workflow map, setup chat, nested automation pages and app structure remain in place.

## Plan and completed stages

1. **Reconcile the baseline. Done.** Stages 1 to 4, including Telegram transport, replies, acknowledgment, triage, threads and brief, were already integrated. The fixed acknowledgment remains on by default. Quiet hours remain SMS-only. No canonical agent migration or unsupported agent Ask was introduced.
2. **Finish Telegram removal. Done in code.** The session-scoped, rate-limited `POST /api/businesses/[id]/outbox/[entry]/delete` accepts only `{ "confirm": true }`. The dispatcher derives identities from stored data, checks sent status and the 48-hour window, atomically claims removal and records the provider result. The outbox offers removal only when the server grants it. Original sent text and audit remain. Removal cannot undo reading. A crashed removal claim stays in progress for operator review rather than claiming success.
3. **Add recorded-fact Customer timers. Done in code.** Callback, Closer, Call Follow-up, Reactivator, Keeper, Referral Ask, Debrief, Show-up Keeper and a manually recorded completed-job Review Asker have pure tested policies. The Customer form records contact, chosen skill, explicit due instant, matching state, stable source reference and evidence. No price, opening or due time is guessed. Customer follow-ups draft Telegram messages; Debrief is owner-only. Due work creates approval cards, never sends. Stable contact/source/window keys dedupe repeated and concurrent runs. Prior approved touches enforce Closer and Call Follow-up limits. STOP, consent, allergy locks and cancellation are rechecked before approval and dispatch.
4. **Add License Clerk facts and reminders. Done in code.** Structured `ProfileDetails.licenses` participates in the profile registry and version history. Internal's form records each license's actual expiry, source and completion. Model extraction cannot supply these dates. Chosen License Clerk creates owner-only 30-day, 7-day, expiry-day and overdue notices from Eastern civil dates. Completion, removal and changed expiry replace stale pending notices. DST and invalid-date tests pass. No renewal or filing is performed.
5. **Wire the existing pages and scheduling. Done.** The new controls sit in disclosures on the existing Customer and Internal pages. They preserve saved state on failure and stay open across authoritative refreshes. The existing dispatch cron checks due work; brief Run now checks reminders before counting its snapshot. No new cron configuration or top-level page structure was added. Pramukh still owns `vercel.json`.
6. **Audit safety and finish documentation. Done for the local implementation.** Fixed persistent allergy-lock checks for older queued replies, uncertain Telegram sends after transport/response/persistence failures, and busy webhook updates being acknowledged before durable completion. Busy updates now return 503 until completed. Completed duplicate updates return 200. Explicit 429/server-error responses may retry once; unknown remote outcomes are not blindly retried. Updated README, API integration notes, security/architecture docs, demo script and actual local screenshots.
7. **Verify. Done locally.** Node 26 `npm run check` passed on the resumed combined tree: type checking, 1,567 tests in 131 files and the production build. Tests include both Store implementations' boundaries, reset, route validation, session/business isolation, repeated work, cancellation, STOP/locks, uncertainty and component refresh regressions. The Closer and Call Follow-up limit now comes only from approved card history; the owner no longer enters a check-in number. Supabase adapter tests use fake HTTP and do not prove live RLS. Browser checks exercised onboarding, Customer's empty and unavailable states, license form to API to saved profile to approval card to refreshed brief, Approvals, the workflow map, the cost view and fit explanations. Internal controls fit 1440, 1024, 768 and 390px in the completed UI pass; the resumed pass rechecked the affected pages at 390px. Customer, Workflows, Approvals, Stack and Tools had no sideways scrolling or page errors. Screenshots are in `docs/screenshots/agent-license-*.png`.

## New persistence and deployment order

Two new append-only migrations are local and unapplied:

- `supabase/migrations/20261108000700_telegram_deletion.sql`
- `supabase/migrations/20261108000800_customer_followups.sql`

Pramukh must apply both before deploying this code. The live project's incomplete migration history means an unreviewed `supabase db push` is inappropriate. The earlier Telegram and brief migrations were reported applied by him in the handoff; this pass did not touch the live database. `customer_followups` has owner RLS, session/business filters, explicit reset coverage and cascading business deletion. Licenses reuse the existing versioned profile. No dependencies were added.

## Pramukh-dependent integration still open

- Canonical `customer` identity, legacy `canonicalAgent`, conversation ownership and shared character metadata.
- `createHandoffCard` and `receiveSupplierInvoice`. Billing, supplier and review material still becomes truthful owner notes until these helpers exist.
- Validated optional `agent` context in shared Ask. General Chat remains available; no unsupported scoped request is sent.
- Bookkeeping and Marketing feeds, brief numbers and scoped thread flag/idea contracts. Current existing invoice and copy features remain intact; these missing new contracts do not mean those existing app features were removed.
- Authoritative completed-job linkage for an automatic Review Asker follow-on. Main's paid-invoice handling exists, but payment alone is not proof the job finished. The new manual recorded-job reminder does not replace that integration.
- Deployment configuration: `.env.example` Telegram names, private webhook secret agreement, dispatch every five minutes and brief hourly under `CRON_SECRET`. Dispatch now also checks owner-recorded due work. No teammate-owned configuration was edited.

## Owner and live-verification gates

No commit, push, PR, deployment, webhook registration or live database change was performed by this implementation pass. Land only when Eric explicitly requests it, following the repository's PR workflow and a fresh merge/check.

After migration application and an authorized deployment, register the bot against the intended URL with the matching private webhook secret. Registration changes the bot's single destination and drops pending updates. Run the controlled phone/Supabase checks for start, message, acknowledgment, approval, reply, STOP, allergy lock, removal, recorded follow-up, saved licenses and brief. Verify Postmark and scheduled execution against real services separately. The local preview uses memory and AI-off templates, and resets when restarted.

The deployment's schedulers currently read a bounded first batch of 200 businesses. Paging or a durable fair-work cursor is needed before operating beyond that bound. Live Supabase/RLS/RPC behavior and shared paid/send races remain integration checks, not claims established by fake HTTP tests.

Model-assisted triage and brief rewording remain optional. The allowed deterministic rules are retained. Owner Telegram notifications are stretch scope without a settled owner-binding contract. Marketing thread use waits on Pramukh. Eric records the ten-minute video; no recording is claimed. Use `docs/agent-demo.md` for the rehearsal and live checklist.

## Worker ownership used in this pass

The coordinator owned shared schemas, Store changes, routes, orchestration, dispatch/approval integration and final browser verification. One worker owned follow-up policy, transport uncertainty and Customer controls. One owned renewal policy, Internal controls and documentation. A separate bounded test worker checked orchestration and API behavior. Work was integrated sequentially and no worker changed Pramukh's canonical groundwork or configuration.
