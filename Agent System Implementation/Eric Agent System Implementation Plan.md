# Eric's agent system implementation plan

Prepared November 8, 2026. Revised November 8 after Eric and Pramukh agreed to split execution ownership.

Eric now implements product agent 1, Customer, and product agent 4, Internal Communications, including their server execution, in addition to his existing presentation, owner controls, documentation and demo work. Pramukh implements product agent 2, Bookkeeping, and product agent 3, Marketing. The consolidated system design also assigns shared agent groundwork, handoff helpers, shared validated Ask integration, deployment cron configuration and environment examples to Pramukh. This replaces the earlier proposal that Eric's coordinator owns all shared foundation work. Eric still owns his Customer/Internal data extensions and execution; shared files use one writer at a time, not blanket ownership by either teammate.

Stages 0-12 retain the presentation checklist, including any remaining UI wiring. Do not redo completed work or branch workers from the old pre-implementation baseline. Start the next worker branches from the verified local checkpoint and merge the shared foundation checkpoint when ready. Execution stages 13-20 add the newly assigned backend work.

The presentation checkpoint is already implemented at `987f690` on `feat/agent-dashboard`, in `/Users/ericwei/Anchored/.claude/worktrees/eric-agent-dashboard`. Its Node 26 typecheck, 1,189 tests and production build passed. New execution work described below is planned, not implemented by this document update. Preserve and extend that checkpoint rather than rebuild it.

## Objective and constraints

Implement Eric's Customer and Internal Communications execution, plus his presentation, owner controls, documentation and demo responsibilities from `Anchored Agent System Design.md`. Extend the existing Next.js application in place. Keep its shell, top-level sections, Workflows map, comparison/adoption flow, general Chat, single Approvals queue, Connections, Stack, Profile, onboarding and authentication behavior.

The implementation adds agent views beneath Workflows. It does not replace the workflow map with an agent dashboard, replace existing automation pages, create another inbox, add another approval service, or move server behavior into components. Eric now implements the rules, persistence extensions, model text generation, authorization and delivery needed for Customer and Internal Communications, in their existing layers. Pramukh retains Bookkeeping and Marketing execution. Shared infrastructure has one integration owner as specified below; execution must never move into components.

The original architecture review used `28c2a76`, PR #45, which matched the locally recorded `origin/main`; the delivered presentation checkpoint is now `987f690`. A previous remote fetch failed on GitHub SSH authentication; refresh and reconcile the baseline before implementation. The handoff's old branch-lag warning is not current. `RTK.md` is referenced by the supplied instructions but was not found at the project root.

### Definition of preserving structure

- Keep `/app`, `/app/new` and `/app/b/[id]` and all existing business sections and their order.
- Keep the sidebar, top bar, business switcher, collapse/resize behavior, mobile drawer and keyboard shortcuts.
- Keep Workflows as the parent for both its existing automation links and the new active-agent links. Add a compact Agents subgroup rather than remove the existing stage/automation groups.
- Preserve every existing `/workflows/<workflow>/<automation>` URL and map anchor.
- Put customer selection inside Customer's page, using a query parameter rather than adding a new top-level Customers section.
- Keep decisions in Approvals. Agent pages show previews and links to the same cards.
- Use the current design tokens, primitives, rail layouts and styling language. No global redesign or new UI framework.

## Ownership and implementation boundaries

| Eric edits | Purpose |
| --- | --- |
| `components/**` | Presentation, presentation adapters, URL helpers, shell summaries, chat UI, connection UI, approval/outbox UI and their tests |
| `app/app/**` | Existing product page composition and nested agent pages, metadata, loading and error states |
| `app/globals.css` and feature CSS modules | Minimal styles for the new UI using existing tokens |
| `README.md` | Owner/demo-facing usage and verified setup instructions |
| This plan and a demo walkthrough in `Agent System Implementation/` | Implementation checklist and recording script |

| Execution area | Owner and boundary |
| --- | --- |
| Product agent 1, Customer | Eric: Telegram transport and ingress, customer identity and threads, deterministic skill routing, checked reply text, acknowledgment authorization, customer timers, channel delivery, thread reads and related API/UI wiring |
| Product agent 4, Internal Communications | Eric: authenticated inbound-email triage, validated handoffs, code-computed brief snapshots, scheduled and manual brief runs, license/renewal reminders and related API/UI wiring |
| Product agent 2, Bookkeeping | Pramukh: Stripe overdue/failed/paid invoice interpretation, invoice identity and reminder limits, paid-invoice cancellation, supplier price extraction and Bookkeeping-specific policy |
| Product agent 3, Marketing | Pramukh: post/review generation and triggers, review policy/flags, content scheduling and review retention; Eric retains its existing owner-facing presentation and copy controls |
| Shared infrastructure | Pramukh owns the first shared-groundwork PR and shared Ask/cron/environment integration; Eric owns Customer/Internal extensions. A designated writer handles each additive shared-file patch. Eric's coordinator serializes his workers and integrates his side, not Pramukh's whole foundation |

### Shared-file coordination with Pramukh

Use the consolidated design's ownership: Pramukh lands canonical ids/characters, parent-key persistence and createHandoffCard first, and supplies receiveSupplierInvoice, Bookkeeping/Marketing feeds, validated agent Ask, vercel.json and .env.example. Eric implements Telegram/threads/rules and Internal jobs/reads. Before each shared-file edit, record one writer and the additive patch; each Store extension still includes both backends and tests. Work against frozen interfaces while the prerequisite PR is being prepared, then merge it into the existing UI checkpoint. See Pramuk Tasks.md and Eric Tasks.md for the complete teammate checklists.

| Shared path | Eric extension and integration responsibility | Pramukh groundwork and agent responsibility |
| --- | --- | --- |
| `lib/domain/types.ts`, `agents.ts`, `paths.ts`, `fields.ts`, `details.ts`, `cards.ts`, `requests.ts`, `plan.ts`, `contacts.ts`, `executor.ts` | Consume Pramukh's canonical/character foundation; add Telegram/contact/rule/thread/profile facts and centralized send safety under the shared-file slot | Canonical ids/legacy compatibility, characters for all agents, handoff/parent-key helper, Bookkeeping/Marketing templates and facts |
| `lib/api/contract.ts`, `schemas.ts` | Customer/Internal read, rule and brief schemas plus typed handlers for Pramukh's shared Ask integration, all matching request types | Shared validated Ask contract and implementation, agent 2/3 reads/fields/errors; no incompatible duplicate schemas |
| `lib/store/types.ts`, `memory.ts`, `supabase.ts`, store tests, new migrations | Session-scoped contracts and implementations, atomic claims/deduplication, RLS, reset and retention for new data | Queries and cancellation/retention requirements for invoices and reviews; dedicated append-only migrations with coordinated timestamps |
| `lib/server/ingest.ts`, `hooks.ts`, `decide.ts`, `dispatch.ts`, `data.ts`, `create-business.ts`, `business-chat.ts`, shared `ai.ts` checks | Thin calls into focused Customer, Internal, Bookkeeping and Marketing modules; one outbox writer and one sender; budgeted model calls | Shared handoff/supplier helpers, Bookkeeping/Marketing handlers, validated Ask wiring and typed events; serialized orchestrator patches |
| Existing shared email connector, cron dispatch route, `middleware.ts`, cron configuration and environment examples | Implement Telegram registration script and Internal brief cron handler; supply route cadence/secret/rate-limit requirements for integration | Own vercel.json and .env.example, register Eric's brief plus Marketing posts cadence once; own Stripe-specific behavior |

Prefer new focused modules such as `lib/server/customer-reply.ts`, `customer-routing.ts`, `triage.ts`, `brief.ts` and `renewals.ts`, with pure policy under `lib/domain`, over interleaving all agents' code inside `ingest.ts`. Filenames are proposed until checked against the implementation branch. Shared-file patches go through the designated writer; do not have three workers edit the Store or dispatcher in parallel.

`components/shell/shell-data.ts` is explicitly Eric's file despite being server-rendered shell code. Keep it focused on shell projections from existing server reads. Do not use it as a location for new business orchestration. Server pages can import approved server read functions; client components cannot import server, store, connector or model modules, even as type imports.

Shared `test/**`, `package.json`, the lockfile, `vitest.config.ts`, architecture tests, auth files and deployment configuration are not blanket Eric ownership. Reuse their current facilities. If one needs a change, agree on its owner first. Put new fixtures beside feature tests to avoid changing shared test infrastructure. QR generation may require a dependency; stage 6 describes that explicit coordination point.

Every new code file needs the existing Module Overview banner and every exported function needs its one-line doc comment. Use straight quotes, sentence-case headings, and periods or commas instead of em/en dashes.

## Existing implementation to reuse

| Existing file or group | Relevant behavior |
| --- | --- |
| `components/routes.ts` | `businessHref`, `automationHref` and stable `cardAnchor` builders |
| `components/shell/shell-data.ts` | Cached business summaries, pending counts, stage-grouped automation links and graceful count-read failure |
| `components/shell/location.ts`, `Sidebar.tsx`, `CommandPalette.tsx`, `AppShell.tsx` | URL-derived selection, navigation, search, drawer, collapse, resizing and shortcuts |
| `app/app/b/[id]/workflows/[workflow]/[automation]/page.tsx` | Existing automation detail page with pending previews and approval links |
| `components/workflows/WorkflowMap.tsx`, `WorkflowGraph.tsx`, `flow.ts`, `automations.ts`, `copy.ts` | Existing comparison/adoption and workflow presentation, which must remain intact |
| `components/chat/ChatWindow.tsx`, `starters.ts`, `chat.module.css` | Shared onboarding/business chat, loading, optimistic owner text, retries, starter prompts, card links and refreshes |
| `components/business/AgentCard.tsx` | Approve/edit/skip/rewrite, copy actions, stale-card handling and feedback |
| `components/business/handoff.ts`, `SendYourself.tsx` | Approved text extraction, clipboard fallback, share support and destination links |
| `app/app/b/[id]/approvals/page.tsx` | Single queue, decided disclosure and resizable outbox rail |
| `components/connections/ConnectionsPanel.tsx`, `ContactsList.tsx` | Existing integration forms and contact management |
| `app/app/b/[id]/page.tsx` | Morning brief slip, pending approvals and workflow ledger |
| `components/api.ts` | `getApi`, `callApi`, safe error text and HTTP status errors |
| `test/http.ts`, `test/next.ts`, `test/setup-dom.ts` | Fetch boundary mocks, deferred responses, router spies and shared DOM setup |

## Stage 0: establish the baseline

1. Review `AGENTS.md`, `docs/architecture.md`, the updated design, relevant security invariants and `.claude/skills/land-a-pr/SKILL.md`.
2. Refresh `origin/main` once GitHub authentication is available. Record the exact starting commit shared with Pramukh. Do not reset the current checkout or discard untracked `MD_files/`.
3. Create Eric's own worktree on `feat/agent-dashboard`, based on that commit. Keep Pramukh's checkout independent.
4. Use Node 26 from `.nvmrc`, run `npm ci`, and run the baseline checks. Record pre-existing failures separately from new ones.
5. Choose an unused port, initially 3101. Leave port 3000 and another person's running server untouched.
6. Capture the current Overview, Workflows map, automation detail, Chat, Approvals and Connections at desktop and phone widths. These are the visual regression reference.
7. Record the top-level navigation order, current workflow URLs, map links, shell behavior and example-business behavior as the preservation checklist.

Exit: a reproducible starting point, Eric-only worktree, known baseline and explicit ownership. Planning and fixture work can proceed while Git authentication is being repaired; do not treat stale remote refs as freshly verified.

## Stage 1: settle the presentation interface

The following interfaces are proposals, not existing endpoints. Eric now owns implementing the Customer/Internal interfaces and their shared plumbing; agree cross-agent fields and compatibility with Pramukh before freezing them. Agree on their exact names, nullability, errors, capabilities and refresh behavior. Eric may implement fixtures and pure views against these proposals immediately; live wiring waits for an agreed server contract.

### Minimum read and mutation contract

| Operation | Proposed interface | Required data or behavior |
| --- | --- | --- |
| Agent dashboard read | Server read function and/or `GET /api/businesses/[id]/agents` | Active core and niche agents, descriptions, characters, enabled skill ids, per-agent activity and counts, Telegram setup, saved rule state, brief summary and explicit capabilities |
| Customer thread read | `GET /api/businesses/[id]/threads?contactId=<id>` | Contact summaries and selected conversation, stable message ids, chronological ordering, direction, text, time, skill, card key, delivery status and pagination metadata if bounded |
| Owner Ask | Existing `GET/POST /api/businesses/[id]/chat`; POST gains optional `agent` | Preserve existing response shape and general-chat behavior. Server validates active agent and enabled skills; never trusts context as permission |
| Acknowledgment rule | `PUT /api/businesses/[id]/standing-rules` | Explicit enable/disable intent; authoritative saved rule state and approval information; server validates permission |
| Daily brief | `POST /api/businesses/[id]/brief` | Code-computed brief or card, last-run time and result identity; distinguish generated from already available or still running if necessary |
| Telegram message deletion | Endpoint defined by Eric's Customer execution, accepting a stored message/outbox id | Only for an eligible sent Telegram message; server returns capability, deletion result and refusal reason. Provider ids and credentials remain server side |

Eric's integration coordinator can combine reads or refine endpoints if the same behavior is covered, with Pramukh consulted on shared data. Freeze one choice before live wiring. Avoid implementing a second endpoint merely to match this document. Server-rendered pages should use provided server reads rather than fetch their own API through a fabricated absolute URL.

### Fields and semantics to resolve

1. Agent identity: canonical `customer`, `books`, `content`, `internal`; niche ids remain `niche:<slug>`. Define legacy `frontdesk`/`followup` normalization on the server. UI labels never control routing.
2. Agent metadata: id, name, job/role, voice rules, limits, enabled skills, active status and capabilities. Reuse domain metadata instead of copying permanent production agent definitions into components.
3. Cards: reuse `CardRecord`, stable key, pending/approved/skipped/superseded state and example marker. Define the handoff parent field's code spelling and whether it names a key or record id.
4. Conversations: stable contact id and display name, Telegram name when available, stopped/blocked status, consent source, allergy lock, last activity, last preview and messages. A Telegram-only contact must not need a fabricated phone number.
5. Delivery: distinguish queued, held, sending, sent, failed and copy/manual actions. Require a display name separate from provider chat id. Define whether a provider id is internal only. Do not imply read receipts.
6. Telegram setup: server supplies a complete test URL or an unavailable reason. Define capability separately for guest-owned businesses and the shared example. Bot credentials never appear in the response.
7. Standing rules: saved enabled state, permission to change, approval timestamp when available, safe disable behavior and what happens to already queued acknowledgments. Server owns that policy; UI describes its returned result.
8. Brief: code-computed waiting count, stake, sent counts, invoice totals, flags and time window; define whether sample cards are excluded. Overview and the generated brief must agree on the same snapshot semantics.
9. Capabilities: separate reading, asking, rule changes, running a brief and integration-secret management. Do not reuse a single `blocked` string as permission for every feature.
10. Errors: agree on 401/403/404/409/429/5xx messages. A missing resource differs from a temporary read failure. An unavailable integration differs from an empty conversation.
11. History: default to one existing owner business-chat transcript shared by general Chat and agent Ask. Selected agent scopes the next request, not a new owner-chat persistence system. Customer Telegram threads remain separate from that transcript.
12. Message deletion: agree whether the design's Telegram `deleteMessage` support is exposed in this iteration. If exposed, require server-provided eligibility and deletion state; the 48-hour provider window is not a client authorization rule. Do not silently drop this design capability or advertise it before it works.
13. Follow-on events: server returns resulting cards and flags. Eric does not infer paid invoices, trigger review requests, cancel sends or classify incoming emails in the browser.

Exit: a written interface agreement and explicit file owners. Eric now implements the real schemas, routes and Store extensions for agents 1 and 4 through the execution stages below. A UI capability stays unavailable until that server implementation and its tests exist.

## Stage 2: create isolated presentation models and fixtures

Suggested feature files are listed below. Names can be consolidated if a component remains small; avoid unnecessary abstraction.

- `components/business/agents/view-model.ts`: display-only types and projections, including legacy/canonical label compatibility during integration.
- `components/business/agents/fixtures.ts`: synthetic fixture data imported only by tests or an explicitly isolated local harness.
- `components/business/agents/AgentWorkspace.tsx`: shared workspace presentation.
- `components/business/agents/AgentActivity.tsx`: pending previews and recent rows.
- `components/business/agents/CustomerThreads.tsx`: customer selection and thread presentation.
- `components/business/agents/agent-data.ts`: browser fetch adapter, only if client reads need one. It wraps `getApi`/`callApi`, not store or connector modules.
- `components/business/agents/agents.module.css`: feature styles.

Steps:

1. Reuse existing types for cards, outbox, skills and business identity. While future API types do not exist, keep only the minimum provisional presentation shape local and clearly marked. Replace it with imported API types at integration. Do not cast new ids into old domain unions or use `any` to hide incompatibilities.
2. Build fixtures for no activity, one active Customer agent, all four core agents, a niche agent, duplicate old Customer ids, pending and decided cards, and unreadable data.
3. Add customer fixtures for long names, no phone, no email, Unicode text, stopped/blocked state, allergy lock, inbound and outbound messages, quiet-hours delay and failed send.
4. Add handoffs, paid-invoice cancellation, brief generation states, example cards, rule enabled/disabled/save failure, unavailable Telegram, and approved Marketing copy actions.
5. Keep synthetic dollar values marked as examples. Do not modify `lib/domain/cases.ts` or seed persisted demo data.
6. Build pure views using props before connecting reads. Do not add a runtime catch that substitutes fixture success when an API fails.
7. Use existing test fetch helpers for interactive tests. Do not mock private hooks or implementation classes. A local harness, if needed for browser QA, must be excluded from public production routing/build output and removed or isolated before landing.

Exit: independently renderable views and meaningful state fixtures. Execution modules can be developed against the frozen contracts while presentation tests continue independently.

## Stage 3: add routes without changing the route tree

Earlier design notes suggested renaming the dynamic directory. With Eric's explicit requirement to preserve structure, no rename is needed.

1. Keep `app/app/b/[id]/workflows/[workflow]/[automation]/page.tsx` in place.
2. Add `app/app/b/[id]/workflows/[workflow]/page.tsx`. At this one-segment depth, interpret `params.workflow` as the agent route token. Name the local variable `agentSegment` so its purpose is clear.
3. Do not add a sibling `[agent]` folder. Next.js cannot use two different parameter names at the same dynamic URL level.
4. Preserve the nested automation page's interpretation of `params.workflow` as an actual workflow id. For example, `/workflows/books` can identify the Bookkeeping agent, while `/workflows/books/nudger` retains its existing automation meaning. Validation depends on route depth.
5. Add `agentHref(businessId, agentId)` to `components/routes.ts`. Encode each dynamic segment with `encodeURIComponent`, including niche ids. Reuse `businessHref`, `automationHref` and `cardAnchor`; do not manually concatenate paths throughout components.
6. Support Customer selection with `?contact=<stableContactId>`. Validate selection against the server-visible contacts. Unknown or removed contact shows a clear selection-level state; it must not make the whole business look missing.
7. Keep the business layout's early `getBusinessOrNotFound` lookup. Resolve agent validity and active status through the session-scoped server reads owned by the integration coordinator. Unknown/inactive agents return 404 or the agreed unavailable state. Never turn read failures into 404s.
8. Add segment `loading.tsx` and `error.tsx` using `PageSkeleton`/existing skeletons and `RouteError`. Confirm inherited boundaries and avoid changing the appearance of existing nested automation failures.
9. Generate the page title from validated agent metadata. Check the actual handling of inactive agents, niche ids and malformed segments.
10. Add URL helper tests and page tests proving old automation links still resolve, the new one-segment page works, and cross-business/unknown agent access follows the server result.

Exit: working additive routes, unchanged existing URLs, no duplicate dynamic segment names and no change to top-level navigation sections.

## Stage 4: extend existing navigation

Files: `components/shell/shell-data.ts`, `location.ts`, `Sidebar.tsx`, `CommandPalette.tsx`, their tests and `components/routes.ts`.

1. Extend `BusinessSummary` with optional active-agent navigation entries. Keep its current `automations` field and stage groups.
2. In `businessSummaries`, reuse current business, choice and feed reads and request caching. Project active agents and pending counts once per business. Do not add per-contact or per-message reads to the shell.
3. Prefer server-canonical card ownership. During compatibility, normalize old Customer ids in one presentation helper, merge duplicate agent rows and count each card key once.
4. Internal Communications appears when the domain says it is active/always on. Respect chosen skills and niche agents. Do not show every core agent as active regardless of the plan.
5. If counts fail, retain unknown (`null`) rather than display zero. If agent metadata fails, preserve the existing navigation and expose retry on the destination; do not break the whole shell.
6. Add an Agents subgroup under Workflows, preserving existing automation groups. Use simple names and avoid a second set of approval badges. The canonical approvals count stays on Approvals; agent page text can show its own pending count.
7. Extend `ShellLocation` to represent the one-segment agent location and preserve the two-segment automation location. Read the currently ignored fourth segment. Use URL depth and validated route identity instead of assuming all Workflows children are automations.
8. Ensure exactly one `aria-current="page"`: Workflows on the map, an agent link on its landing page, or the existing automation link on an automation page. Check ids shared across workflows, such as `books`.
9. Add current-business agent commands to the command palette. Keep existing page and business commands, search behavior, arrow navigation, Enter and Escape.
10. Preserve collapsed sidebar behavior: child links remain hidden in the rail as currently designed; agents stay reachable through Workflows and the palette. Preserve mobile drawer close-on-navigation and focus behavior.
11. Keep existing `g` shortcuts. Ensure the `/` shortcut can focus the agent Ask composer by reusing the existing `.chat-stage` wrapper; change the selector only if necessary.
12. Test shell states using local test fixtures rather than editing shared `test/shell-fixtures.ts` without ownership agreement.

Exit: discoverable active-agent pages, preserved automation navigation, accurate selection and unchanged shell controls.

## Stage 5: implement the shared agent workspace and Ask

Files: new agent presentation components, the new route page, `components/chat/ChatWindow.tsx`, `starters.ts`, `chat.module.css`, `components/agent-labels.ts` and tests.

### Shared workspace

1. Compose a `PageHeader` with the actual agent name and one-line role. Use a short sentence saying who does the work, such as "Anchored drafts replies. You approve them."
2. Show enabled skills as readable jobs. Put voice, full skill detail and hard limits in a `<details>` section. Do not create a visual card for every piece of metadata.
3. Render pending card previews with title, recipient, short body and a stable link to Approvals. Use `cardAnchor(card.key)`, never an unstable materialized id.
4. Keep one clear Review action per preview region. Do not mount another editable/approvable `AgentCard` queue on agent pages.
5. Show recent decisions and delivery statuses separately. Approved is not equivalent to sent; skipped and superseded are not successes. Link to the same canonical card/history when available.
6. For handoffs, show the source and receiving agent and a parent-card link only when the parent is visible. If it is unavailable or deleted, show descriptive text without a broken link.
7. Show empty, loading, unavailable, partial-failure and example states explicitly. If activity fails, retain readable agent metadata and give the activity region its own retry where possible.
8. Preserve niche-agent behavior: use the same workspace if active niche agents get links; do not drop them by filtering only the four core ids.

### Ask box

1. Extend only the business arm of `ChatWindowProps` with optional agent context and an accessible label/placeholder override if needed. Intake's discriminated props and behavior remain unchanged.
2. Pass agent context to business chat POST as the agreed field. General Chat must still send exactly `{ text }` when no context is provided.
3. Keep shared owner-chat history unless the contract explicitly changes. Explain the current agent context above the composer. Do not represent owner Ask history as customer messages.
4. Reuse the existing composer, Enter/Shift+Enter behavior, starter chips, owner-message display, loading feedback, retry and approval-card links.
5. Make starters appropriate to that agent's enabled skills and facts already available. Do not offer unsupported money movement, confirmed bookings or direct publishing.
6. Key the business chat instance by business and agent context, or explicitly reset its state when either changes. Prevent a late response from the previous workspace overwriting the current one. Account for both initial GET and POST responses, not only unmounting the load request.
7. Prevent duplicate submits while pending, preserve unsent text after failure, and avoid a failed retry duplicating a previously successful action. Use any server idempotency semantics agreed in stage 1; do not claim the UI alone guarantees exactly-once execution.
8. Refresh the surrounding server page after a new card or profile change, as the existing chat does, so sidebar counts and workspace previews update.
9. An inactive agent or no enabled skill gets explanatory copy and a link to Workflows. The server still enforces it. Do not silently route to a different agent from the UI.
10. Shared example remains read-only. Guest-owned businesses follow server capabilities and can use Ask when permitted. Do not copy the existing signed-in integration restriction onto Ask.
11. Announce generated card links and errors accessibly. Keep the thread named for the actual context and maintain focus after send/retry.

Exit: all agent pages share a coherent presentation, Ask uses the existing chat and approval flow, and onboarding/general Chat regressions are covered.

## Stage 6: add Telegram setup and the acknowledgment control

Files: new `components/connections/TelegramSetup.tsx`, `AcknowledgmentRule.tsx`, connection CSS/tests, Customer workspace and `app/app/b/[id]/connections/page.tsx`.

### Telegram setup

1. Build one reusable setup component and mount it on Customer and Connections with the same server-supplied URL and capability state.
2. Label it "Telegram test link" and explain that customers open it to message this business. Do not label a configured bot as having received a customer message unless activity proves it.
3. Show an Open Telegram link, Copy link control and scannable QR. Render only an agreed Telegram HTTPS host/scheme as an external action, use safe external-link attributes when opening a new tab, and avoid interpreting arbitrary response text as a URL. Reuse `copyText` for clipboard failure handling; retain a selectable URL when copying is unavailable.
4. Generate the QR locally from the exact complete test URL, with an existing audited dependency if one is already present. The inspected package manifest has no QR dependency. If adding one is necessary, agree on ownership of `package.json` and the lockfile before editing them. Do not hand-roll a fake QR or send the business link to an outside QR-image service.
5. Verify QR scan correctness on a phone, not only SVG appearance. Provide accessible explanatory text and a visible ordinary link as the nonvisual fallback. Keep quiet-zone contrast and prevent layout clipping.
6. Render an unavailable reason when the server has no URL. Do not construct a URL from a guessed username, expose a raw hook id as a usable link, or show a broken QR.
7. Guest-owned businesses can see their own link without connecting credentials. The existing `ConnectionsResponse.blocked` restriction applies to secret-bearing integrations, not universally to Telegram setup.
8. For the shared example, show the server-defined unavailable/setup-your-business state. Do not create a live shared customer inbox in client code.
9. Preserve email forwarding, outbound email and Stripe setup. Hide or mark retired Twilio setup according to the backend connection contract, without deleting working unrelated forms. Missed-call demo copy says simulated.
10. Update the Connections page description so it no longer tells the owner to connect a Twilio number for the Telegram demo.

### Acknowledgment control

1. Default visually and behaviorally to the authoritative server state, which is off until explicitly approved. Never enable because the plan was approved unless that approval explicitly included this rule.
2. Show the exact template before consent: "Thanks, {business} got your message and will reply soon." State that only this acknowledgment can go out without approving each reply and that other drafts still wait for approval.
3. Explain that quiet hours and stop requests still apply. Do not promise an immediate reply at night.
4. Use a labeled checkbox or switch with an explicit save/approve action. Separate draft input from saved state; disable repeat saves and avoid optimistic success.
5. On success, adopt the returned rule state and approval information, announce success and refresh the other surfaces. On error, keep the last saved state clear, retain the owner's attempted choice and provide Retry.
6. Handle disallowed changes and concurrent-state errors using the server response. Do not infer authorization from `business.kind` or guest status alone.
7. Provide disable behavior and display what the server says about queued acknowledgments. UI does not cancel outbox entries directly.
8. If the backend chooses plan approval as the rule-approval mutation, extend `PlanBand`/`ApprovePlanButton` only after agreeing the combined request. Do not accidentally couple ordinary plan approval to automatic sends.

Exit: real URL and QR work for guest-owned businesses, unrelated integrations remain usable, and the standing rule has explicit, truthful owner approval.

## Stage 7: implement Customer's conversation view

Files: `CustomerThreads.tsx`, optional smaller `CustomerList.tsx`/`ThreadMessages.tsx`, feature adapter/CSS and tests. Extend `components/connections/ContactsList.tsx` only for its existing contact-management presentation.

1. Place the customer list and selected thread inside Customer's existing workspace. On wide containers use columns; on narrow containers stack them and provide a clear return to the customer list if a selected-thread-only mode is used.
2. Keep selection in `?contact=` so reload, direct links, Back and Forward behave consistently. Preserve unrelated query parameters and use the stable contact id, not name or Telegram username.
3. Order customer summaries by server-provided last activity. Show readable names, last-message preview and time. Do not imply unread status without an actual unread field.
4. Select a sensible initial customer when no query is given; show a genuine empty state when there are none. For an unknown/removed selection, explain and offer the visible customer list.
5. Read the selected customer's ordered messages through the agreed data interface. Do not join records by matching names, amounts, email fragments or phone guesses.
6. Render inbound and outbound direction with words and layout, not color alone. Show business-local timestamps using existing timezone conventions. Allow long URLs and unbroken text to wrap.
7. Render message text as text. No raw HTML or Telegram Markdown interpretation. Keep intentional newlines.
8. Show saved consent/STOP/blocked state and the allergy lock. A stopped contact stays readable; the UI does not offer a bypass, manual Telegram send or client-side restart.
9. Show linked pending drafts as previews leading to Approvals; show approved/queued/sending/sent/failed states accurately. Reuse existing card anchors.
10. Keep Ask distinct from the customer conversation. Do not add a freeform "Send to customer" composer. An Ask request that needs a recipient must have server-validated recipient context, not a hidden assumption about the selected row.
11. On customer changes, reset selection-specific errors/loading and reject late results for the old contact. Preserve draft text only within its correct context.
12. Provide an explicit Refresh action for inbound activity. Start without a new real-time subscription system. If polling becomes necessary for the demo, use a bounded visible-tab-only interval, stop on unmount and prevent refresh from wiping an active editor or Ask draft.
13. If threads are bounded, follow server pagination/order metadata and provide Load earlier. Do not invent pagination or claim to show full history when only a window is returned.
14. Extend Connections contact rows to display Telegram name/availability and channel-appropriate consent text. Preserve add/remove behavior and existing email/phone contacts. Do not implement chat-binding or consent-policy changes in the browser.

Exit: customer selection, history, safety state and approval links work without creating a second inbox or a direct-send path.

## Stage 8: integrate approvals, delivery and Marketing copy

Files: `app/app/b/[id]/approvals/page.tsx`, `components/business/AgentCard.tsx`, `handoff.ts`, `SendYourself.tsx`, relevant styles/tests and agent activity views.

1. Add Telegram to exhaustive channel display maps once the backend type exists. Render a readable customer name and "Telegram"; do not display provider chat ids as phone numbers.
2. Extend outbox rendering so Telegram is a message with body and delivery status, rather than falling through to a generic list-action label.
3. Update card source/recipient wording and approval toasts. "Approved" means authorization; "Sent" requires a sent result. A queued send never gets a sent toast.
4. Show delayed send time in the established business timezone and the server's reason. Failed or blocked sends show the actual next step, without offering a quiet-hours, consent or STOP bypass.
5. Make `handOff` explicitly handle Telegram before the list-copy fallback. A Telegram failure does not become an `sms:` URL, a `mailto:` link or a button into a customer's private chat. Prefer no manual-send fallback and a clear instruction to inspect the connection unless the agreed server response supplies an authorized recovery action.
6. Update generic fallback text such as "Didn't send. Send it yourself." for Telegram so it does not imply a supported recovery that is absent.
7. Show rule-authorized acknowledgment rows truthfully: "Sent under your acknowledgment rule" or the queued equivalent. Do not call them individually approved by a tap. Allow the server's association model rather than fabricating a missing approval card.
8. Display handoff parent links using stable keys. Keep approval ownership and recipient authoritative from the card, not the referring page.
9. Preserve stale-card 409 handling, double-click prevention, edit/rewrite behavior, allergy locks, flag cards, example tags and decided-history state.
10. Preserve the existing Marketing approval-and-copy workflow. Reuse `copiedThing`, `copyTextFor`, `postText`, `approvedDraft` and `SendYourself`; do not build a second clipboard implementation.
11. Verify copied text is the exact approved or edited content, without logged action prefixes. Destinations come from the business's configured reach/tools or safe server data. Never describe a copied post as published.
12. Clipboard success before an approval request is not approval success. The existing code copies inside the user gesture before the decision response. If that response fails, say that copying did not record approval and keep the pending card retryable; do not show an approval-success toast. Do not claim the browser can undo a copy.
13. Check `superseded` display specifically: current `decidedLabel` can fall through to "Approved". Give replaced drafts an explicit label and no action that revives them.
14. For the design's sent-message deletion capability, render a quiet "Delete Telegram message" action behind secondary details only when the server says the entry is eligible. Confirm the specific message before calling Eric's validated Customer endpoint. Disable repeat clicks, show the returned result, keep audit/history visible, and handle expired-window, already-deleted and provider-failure responses. Never describe deleting a message as undoing the customer's knowledge of it. Eligibility and the provider call belong to Eric's Customer server execution, never the component.
15. Refresh the feed after decisions so counts, linked cards, threads and Overview converge. Do not derive paid-invoice cancellations from a local click; display the backend's resulting state.

Exit: one approval queue, correct Telegram statuses and recovery, preserved editing, and truthful copy-versus-publish behavior.

## Stage 9: extend Overview and complete the other agent views

Files: `app/app/b/[id]/page.tsx`, its tests, agent workspace components, optional `BriefRunButton.tsx`, `components/view-helpers.ts` for formatting only.

1. Preserve the existing header, morning brief slip, approval links, stack-cost line and workflow ledger. Add compact per-agent rows within that established page rather than replace its information architecture.
2. Read the backend's brief snapshot and agent activity data. Reuse existing formatting helpers. Do not reimplement overdue totals, supplier comparisons, last-brief windows or stakeholder ranking rules in React.
3. Keep sample-card money excluded where the current app excludes it. Do not label dollars riding on approvals as money recovered or revenue earned.
4. Add a Run now control to the brief region. Disable duplicate requests while pending; show the returned run time/result and refresh the same brief. On failure keep the last successful brief visible with a clear error, not a zeroed-out dashboard.
5. Match Internal Communications' brief display and Overview to the same server snapshot. Clearly distinguish no run yet, an empty successful brief, stale available data and an unreadable brief.
6. Bookkeeping view: pending reminders with validated amount/invoice reference, payment/cancellation activity and supplier flags. No charge, refund, payment link invention or money movement control.
7. Marketing view: pending post/review previews, review flags and approved copy destinations through Approvals/outbox. No Google/Meta connect or publish implementation.
8. Internal Communications view: triage results, source/target handoffs, owner-only notes, renewal reminders, brief output and Run now. No customer-send control and no owner Telegram notification feature, which remains stretch/backend scope.
9. All views consume explicit enabled skills and capabilities. A business that uses an outside tool for a workflow should retain that tool's role on the map; agent views do not silently activate a workflow.
10. Update explanatory copy wherever "nothing sends without a tap" would be inaccurate after the owner enabled the acknowledgment rule. Keep the exception short and consistent across Approvals, workspace and Overview.

Exit: all four agents have useful, accurate views, and Overview remains recognizable with one source of truth for numbers.

## Stage 10: compatibility, styling and regression pass

### Agent-id and channel compatibility

1. Search Eric-owned files and tests for `frontdesk`, `followup`, five-agent wording, Twilio, SMS-specific defaults and exhaustive channel/core-agent maps.
2. Update `components/agent-labels.ts` and owner copy to Customer. Pramukh owns the canonical Customer/character groundwork and legacy compatibility; Eric integrates it and updates Customer-specific extensions through the shared-file slot. Update domain and UI together and preserve unrelated agent data.
3. Check marketing components that compile against `CoreAgentId`: `components/site/harbor/Boats.tsx`, `FleetChart.tsx`, `watch-bill.ts` and their tests. Add/update Customer identifiers and labels using existing illustration assets and layout. Keep the landing page sections and visual composition intact; no illustration redesign.
4. Update `components/site/AgentRoster.tsx` accessible wording from five core agents to four. Check `ApprovalPreview.tsx` for Telegram channel labels and the acknowledgment exception.
5. Check `components/workflows/flow.ts`, `automations.ts`, `copy.ts`, onboarding/profile presentation, simulator labels and page test fixtures for assumptions inherited from the old ids. Change only Eric-owned presentation references.
6. During independent work, keep compatibility projections small and local. Do not add production mock domain definitions. When merged domain types are available, replace temporary shapes and remove obsolete UI aliases only after tests pass.

### Visual and accessibility rules

1. Use `--s-1` through `--s-8`, `--pad` and `--fs-*`; use the existing colors and button variants.
2. No new page/section max-width. Cap only running text near 65ch. Repeated items use the repository's auto-fill/minmax grid pattern.
3. Adapt workspace columns with `@container app`, accounting for expanded and collapsed sidebar widths. Keep the shell's existing breakpoint behavior unchanged.
4. Use one filled action per region, one badge at most per card, and boxes for decisions, brief and bill rather than every detail. Keep yellow limited to existing permitted meanings.
5. Use logical headings, labels, status announcements, visible focus and useful link names. Do not announce an entire long transcript on each refresh.
6. Ensure keyboard-only customer selection, query navigation, Ask, rule approval, clipboard recovery, Run now and approval links.
7. Check empty states, 200% zoom, long business names, long customer messages, Unicode, long URLs and unavailable clipboard. Respect reduced motion and current scroll behavior.
8. Check loading/error boundaries do not remove shell navigation or expose another business's previous client state.

Exit: no compile break from the domain/channel migration, no structural redesign, and accessible layouts across available container sizes.

## Stage 11: verification and integration

### Tests to add or extend

| Area | Owner-visible assertions |
| --- | --- |
| Route helpers and new agent page | Encoded ids, valid/unknown/inactive agent handling, stable approval links, preserved automation URLs |
| Sidebar and location | Active agents and niche agents, retained automation groups, exactly one current page, collapsed behavior and unknown counts |
| Command palette | Search agents, keyboard navigation and correct current-business destinations; existing commands retained |
| ChatWindow | Agent context included only for agent Ask, general `{ text }` unchanged, onboarding unchanged, retry/busy behavior, card link refresh and late-response isolation |
| TelegramSetup | Real URL/copy state, unavailable state, guest-owned versus shared-example behavior and accessible fallback |
| AcknowledgmentRule | Exact template shown before approval, returned state on success, no false success on failure, saved-state clarity and duplicate-click prevention |
| CustomerThreads | Selection/back behavior, no stale cross-contact data, escaped message text, STOP/lock visibility, empty/deleted contact, load/retry and linked card status |
| Approvals/AgentCard/handoff | Telegram labels, approved versus sent, quiet-hours hold, no unsafe fallback, superseded state, stale 409, rule-authorized rows and deletion eligibility/result states |
| Marketing copy | Exact approved/edited text, destination links, clipboard failure and decision failure, no published claim |
| Overview/brief | Per-agent links, actual counts, sample exclusion, last successful brief survives errors and Run now refreshes the shared result |
| Marketing compatibility | Core-agent identifier migration and existing landing composition remain valid |

Use colocated tests, `stubFetch`, `sentJson`, `deferred`, current router mocks and accessible role/name assertions. Do not assert class names or write tests that merely restate markup. Server-page unit tests can follow the repo's existing page-read mocking pattern; interactive network behavior stays mocked at fetch. Test shared primitives only when their behavior actually changes.

### Check order

1. Run targeted tests for each stage while implementing.
2. Run typecheck when route params, agent ids, channels or request shapes change.
3. Once the complete Eric feature set is ready, run `npm run check`. Do not claim this was run during planning.
4. Build and serve Eric's work on an unused port, for example `ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p 3101` after `npm run build`.
5. Browser-check desktop, narrow desktop with a wide sidebar, collapsed sidebar, tablet and phone. At minimum check 1440px, 1024px, 768px and 390px viewports, plus container width changes from the sidebar. Confirm no horizontal document overflow.
6. Check home, onboarding, general Chat, Workflows/map, an existing automation detail, Tools, Approvals, Connections, Stack, Profile, each new agent view and relevant links. Preserve compare/adopt behavior and example tour.
7. Verify sample states in tests/local fixture harness. Verify the real local app separately with the actual available backend; do not treat fixture success as end-to-end success.

### Live integration handoff

1. Integrate the backend branch through the agreed PR/main workflow. Replace provisional UI types with real API types, connect adapters to the agreed server reads/endpoints, and remove test-only runtime wiring.
2. Compare actual and proposed contracts field by field: canonical ids, nullability, capabilities, card keys, parent references, customer names, status semantics, rule authorization, timezone and brief sample accounting.
3. Eric fixes his UI and Customer/Internal execution issues, including the related routes, schemas, stores and providers. Pramukh fixes Bookkeeping/Marketing execution. Route shared-file fixes through the agreed coordinator rather than editing across worker boundaries.
4. Independently refresh two different businesses and browser sessions; confirm UI state, customer selection, messages and Ask context never bleed across them. Eric must prove server isolation for his new methods, routes, jobs and webhook lookups; Pramukh proves it for his additions, and the combined suite covers both.
5. Create a guest-owned business and choose the necessary agent workflows. Confirm the shared example remains read-only.
6. Open/scan that business's Telegram link on a real phone. Start the chat, send an inquiry, refresh Customer, open the resulting card, approve, and receive the actual reply.
7. Enable the acknowledgment rule explicitly and verify a rule-authorized reply. Disable it and verify saved state. Check quiet-hours hold through controlled tests without changing production clocks.
8. Send `/stop` and verify stopped state and a blocked later send. Verify allergy lock through the agreed safe demo/test scenario.
9. Simulate an invoice reminder and paid cancellation using backend-provided fixtures/events. Confirm canceled work is no longer offered as pending. Do not send duplicate test reminders to an unrelated real customer.
10. Generate a Marketing draft, edit/approve/copy and open its destination without claiming publication. Run the brief and compare counts against the live queue.
11. Verify no-AI template fallback with Eric's Customer/Internal execution and Pramukh's Bookkeeping/Marketing modules, unavailable Telegram configuration and a failed-network recovery.
12. Run `npm run check` on the final combined tree before landing.

Exit: fixture/component completion and real end-to-end completion are both recorded separately. Backend availability is a final integration requirement, not a blocker on Eric's independent presentation work.

## Stage 12: documentation, demo and PR delivery

1. Update README's opening approval claim and Approve section to describe the explicitly authorized acknowledgment exception, Telegram test link and QR, four agents, shared Approvals queue and copy-only Marketing output.
2. Update texting/Connections instructions for Telegram. State missed calls are simulated. Preserve valid local-run, provider, research, tool-discovery, auth, data and deployment documentation.
3. Document only implemented and verified settings. Eric owns Telegram and Internal Communications setup instructions and server-only environment configuration; Pramukh owns Stripe/Marketing-specific settings. Credential provisioning, provider spend caps and Telegram webhook registration are explicit deployment steps, with no secret values in code, screenshots or logs.
4. Do not replace screenshots unless new, verified screenshots exist and ownership of their output paths is agreed. Do not leave descriptions claiming outdated Twilio UI is the current setup.
5. Write a demo walkthrough in `Agent System Implementation/Eric Agent Demo Walkthrough.md`: guest access, example exploration, tool comparison, own-business setup, workflow choice, Telegram inquiry, approval/reply, acknowledgment rule, Marketing copy, brief and safety behavior.
6. Keep the video at the design's 10-minute target. Suggested sequence: 1 minute product and example, 2 minutes onboarding/compare/adopt, 3 minutes real Telegram and approval, 2 minutes remaining agents/copy/brief, 1 minute safety, 1 minute results and access instructions. Adjust after timing an actual rehearsal.
7. Label live, simulated and unavailable pieces truthfully. Use synthetic customer data and do not show tokens or private customer messages in screenshots or the recording.
8. Prepare small, reviewable commits using repository Conventional Commits, for example `feat(agents): add workspaces under workflows`. No AI attribution. Commit only intentional files; the original `MD_files/` contains unrelated untracked documents.
9. Follow `.claude/skills/land-a-pr/SKILL.md`: fetch, merge `origin/main`, resolve conflicts preserving both teammates' intent, run `npm run check` on that merged tree, then push and create the PR using the repository template.
10. PR text states owner-visible changes, unchanged URLs/layout, tested states, actual test results, required backend interfaces and any unresolved limitations. Name the actual migration/environment prerequisites for Eric's execution and any required Bookkeeping/Marketing integration; do not describe this expanded implementation as presentation-only.
11. Do not land fixture-only production features as complete. A preliminary UI PR must clearly identify unavailable server-dependent controls and show truthful unavailable states.
12. Merge only when instructed under the landing workflow. GitHub authentication is an operational prerequisite for fetching/pushing, not a reason to discard local work.

## Execution stage 13: freeze shared contracts and build the data foundation

Stages 0-12 retain the presentation checklist and its delivered checkpoint. The next execution wave starts here. Run stage 13 before live wiring; focused Customer/Internal modules and UI tests can proceed in parallel against the same written contract while Pramukh supplies groundwork and the coordinator completes Eric's data extensions. Do not claim there are no integration dependencies.

1. Confirm Eric owns Customer and Internal, Pramukh owns Bookkeeping and Marketing, and record the shared-file writer convention above. Split three Eric workers as Customer execution, Internal execution, and UI integration; Pramukh supplies the shared groundwork; Eric's root coordinator handles his extensions and serializes his workers. See the revised three-agent work split for exact files.
2. Inventory the checkpoint: five persisted core ids still exist, Telegram is not a backend channel, customer thread storage does not exist, forwarded emails currently create an owner list card, and the current brief is a pure feed/stack summary. Existing UI is not proof those execution features are live.
3. Freeze API names, typed source events, card parent references, contact identifiers, invoice/review references, delivery/rule audit fields, result statuses, errors and business capability flags. Preserve existing general-chat request compatibility and chosen-skill checks.
4. Define one customer thread per business/contact, with structured state for open quote, pending booking, catering and current skill. Do not decide open/closed state by asking the model or matching an arbitrary message substring. Store incoming/outgoing text, direction, skill, stable source/card ids, provider id, time and actual delivery outcome.
5. Define durable Telegram hook lookup and chat-to-business binding. One shared bot receives messages with only a chat id, so the current active business/session must be recoverable without a browser cookie. `/start` selects the latest business; contacts/history remain tenant-scoped. Never trust a session id supplied in an event payload.
6. Add append-only migrations for Telegram contact fields, random business hook ids, thread/messages/state, durable update/work claims, standing-rule authorization, card parent keys, rule-tagged outbox entries, brief runs/watermarks and any structured renewal facts. The current profile has no structured renewal calendar; add facts/evidence through the registry, never guessed dates. Reuse appropriate existing data representations instead of assuming every field is a physical business-table column.
7. Every new Store method lands in interface, memory, Supabase and tests together. Current Store has `recordEvent` but no event-list/snapshot query; add bounded reads for the brief and audit. Scheduled jobs need an explicit authorized deployment-wide due-work query or job index, not a loop that only sees one visitor's session.
8. Document each necessary deployment-wide lookup, such as hook/chat binding and due jobs. Return the owning session with the result; every later read/write uses that session. Keep these exceptions narrow and update architecture/security documentation rather than quietly treating all Store methods as global.
9. Define atomic update claims and idempotency keys for provider updates, handoffs, timer windows, brief business/day runs and renewal windows. A seen-update flag alone is not sufficient: distinguish claimed, completed, failed and retryable work, including recovery after a crash.
10. Choose durable processing semantics for Telegram. A webhook may answer promptly only after work is durably accepted; do not acknowledge and then rely on a detached serverless promise. Until a durable worker is available, await the required safe processing and return errors that permit provider retry. Explicitly handle crashes between event, message, card and outbox writes.
11. Apply RLS, session/business indexes, foreign-key/deletion behavior and cross-tenant tests. Extend reset and guest retention to all added rows, bindings, runs and dedupe records without clearing another business's data. Decide bounded retention for customer text and review references with their owners.
12. Integrate Pramukh's canonical Customer metadata/character and legacy-record migration without losing niche agents or existing saved profiles/cards. Send further foundation changes through his ownership slot. Preserve compatibility with `frontdesk`/`followup` records until both branches and the UI compile against the merged types.

Exit: the foundation contract, claims, migrations and both Store backends are tested. Workers have stable interfaces, and shared changes do not delete Pramukh's behavior.

## Execution stage 14: Customer ingress and Telegram identity

Owner: Eric's Customer execution worker; shared-store/orchestrator patches go through the coordinator.

1. Implement `lib/connectors/telegram.ts` with fake-fetch tests for update parsing, constant-time secret validation or reuse of the secret helper, `sendMessage`, inline URL buttons, `deleteMessage`, provider errors and message ids. Send plain text with no parse mode. Do not forward arbitrary model-supplied links as buttons.
2. Add `/api/hooks/telegram`. Verify `X-Telegram-Bot-Api-Secret-Token` before any lookup/write; validate and bound payloads, normalize supported message/member update shapes, ignore unsupported updates safely and redact customer content from logs.
3. Atomically claim `update_id` for the shared bot; process duplicate deliveries once, and recover failed/incomplete processing according to stage 13. Do not burn a second model call or send twice on retry/concurrent delivery.
4. Generate a non-guessable per-business hook during creation and define safe backfill for existing guest-owned businesses. The shared example stays read-only and never gets a globally shared customer inbox. Expose only the public test URL through the authorized business read.
5. `/start <hookId>` validates the target, binds that Telegram chat to its latest business, upserts the scoped contact and records consent as messaging first. Store Telegram ids losslessly and do not require a phone/email. Handle malformed/unknown hooks without leaking business data.
6. Define command-confirmation authorization centrally: the design includes a fixed business-binding confirmation, but only acknowledgment is a standing business-reply rule. Resolve that protocol notice explicitly with the single decision/send path and tests; do not add direct connector sends in the webhook or a second free-text automatic-reply exception.
7. `/stop` and blocked-bot member updates persist opt-out before any further drafting/sending. Keep STOP across agents and queued work for that business; no ordinary message silently restores consent. Define explicit restart semantics and behavior on business rebind, unbound chat messages and unknown contacts. Record whether STOP suppression is bot-wide as well as business-scoped; queued work from an older binding must not bypass the latest binding or the customer's stop choice.
8. Rate-limit inbound work per chat and business in addition to the hook bucket, before model calls. Authenticate scheduled/public mutation entry points and cap model calls through `getBudgetedLlm`.
9. Append the inbound message and source event once and invoke deterministic Customer routing. Keep simulator missed calls separate from live Telegram; forwarded customer emails remain one-off cards, not attached Telegram histories.
10. Test invalid/missing secrets, malicious payloads, update races and crash recovery, `/start` rebind, unbound chat, Telegram-only contacts, guest ownership, cross-session access, `/stop`, block and restart policy.

Exit: real inbound messages can become exactly one scoped event/thread turn and draft, with no unauthorized direct reply.

## Execution stage 15: Customer routing, replies and scheduled work

1. Merge legacy Front Desk/Follow-up into canonical `customer`, retaining the 19 skill ids and active niche precedence. Code filters routing to the business's selected skills; inactive work produces an explicit no-handler result, not a silently activated skill.
2. Route from structured thread state: open quote to Closer, pending booking to Show-up Keeper, catering to Catering Responder, otherwise Inquiry. Define deterministic precedence when states coexist. Billing questions produce a linked Bookkeeping handoff, with owner-note fallback when Bookkeeping is inactive.
3. Reuse the existing skill templates. Draft free text from the approved profile, current event and last 10 authorized thread messages, marked as untrusted data. Apply Customer role/voice metadata within the owner's business voice.
4. Use `getBudgetedLlm` at the selected skill tier. Validate nonempty/length-bounded text, unsupported prices, times, links, numbers, allergy content and placeholders. The current `newFacts` checker is a reusable backstop, not proof that every promise or name is supported; test profile facts and thread context carefully and use a checked template fallback.
5. Enforce allergy locking before ordinary drafting or acknowledgment. A lock persists across turns until the explicitly defined owner-handled transition; approving another card must not clear it accidentally.
6. Define safe behavior when another inbound turn arrives while a reply is pending or approved but queued. Supersede pending drafts only through existing atomic methods, preserve history, and recheck stale context at approval/send; do not silently send a reply invalidated by a later STOP or lock.
7. Implement reminder/timer eligibility for selected Callback, Show-up Keeper, Catering, Closer, Call Follow-up, Debrief, Reactivator, Keeper, Referral Ask and Review Asker skills. Base times and prices on recorded facts, track per-contact/job windows, dedupe runs and respect completion/response/opt-out. Do not invent open appointment times from the current demo template.
8. Extend owner Ask on the server with optional validated agent context while preserving general Chat and onboarding. Code chooses the request skill from that agent's enabled skills, then the model writes text only. A selected contact must be validated server side, never inferred from a hidden UI row.
9. Expose paged/bounded customer thread reads and delivery/card links for the owned business. Separate owner-chat history from customer-thread history. Return complete capability and error states to the existing components.
10. Consume Pramukh's `invoice-paid`/finished-job event contract for Review Asker with a stable invoice/job/contact id and duplicate suppression. Eric owns the Customer follow-on; Pramukh owns payment truth, reminder cancellation and the policy deciding a job is paid. Do not infer identity by matching names or invoice amounts.
11. Test each routing branch, inactive skills, niche precedence, missing facts, prompt-injection attempts, fact-check fallback, persistent locks, concurrent turns, timer boundaries, repeated paid events and no-AI/budget-exhausted operation.

Exit: Customer drafts and follow-ups are grounded, deterministic, scoped and idempotent before any send.

## Execution stage 16: acknowledgment, approval and delivery

Owner: Customer worker defines the behavior; the coordinator edits centralized safety/decision/dispatch files once.

1. Add server-side acknowledgment rule state, initially off, with explicit owner approval and an audit record. Keep this separate from general plan approval unless that exact template was explicitly included. The acknowledgment is fixed text and makes no model call.
2. Route rule-authorized acknowledgments through `decideCard` or its explicitly extended centralized decision entry, keeping it the only caller of `Store.addOutbox`. Reject client attempts to name a rule that was never approved. Record rule/template/authorization provenance without fabricating an owner tap.
3. Run `checkSend` before queuing and at dispatch for every customer-facing send. Add Telegram consent/STOP handling and the designed quiet hours for Telegram and customer email; retain SMS-only opt-out suffix behavior. Internal list cards never become customer sends.
4. Define acknowledgment frequency and idempotency per inbound event/conversation window and rule disable behavior for queued acknowledgments. Recheck current authorization, STOP, locks and relevant context at dispatch so a revoked rule or new STOP cannot slip through a stale queue.
5. Add Telegram delivery planning and the dispatcher branch, stable recipient/contact binding and provider-id persistence. Prevent two cron workers claiming one row. Record outgoing thread status without claiming delivery before the provider responds.
6. Define timeouts, retryable versus permanent provider errors and ambiguous send outcomes. A claim prevents concurrent sends but cannot promise exactly-once remote delivery after a crash following provider acceptance. Record uncertainty and avoid blind retries that duplicate customer messages.
7. Add authorized sent-message deletion using a stored message/outbox identity, actual provider window and server eligibility. Preserve audit/history and report expiry/already-deleted/provider failures. UI confirmation does not replace authorization, and deletion does not undo what a customer has read.
8. Keep Telegram secrets server side: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, existing connector key where applicable and cron bearer secret. Register the deployment's shared webhook with supported updates after configuration is ready; never expose/register secrets through the browser.
9. Verify Telegram delivery is reusable by Pramukh's Payment Nudger through the same gate, not a second sender. Let Pramukh supply the trusted invoice data and recipient linkage.
10. Test default-off rule, forged rule authorization, double-clicks, concurrent claims, quiet-hours boundary, STOP/lock/revocation after queueing, provider failure/uncertainty, outbound-history consistency and deletion isolation.

Exit: all Customer sends use the one approval/dispatch chain and have truthful persisted outcomes. No immediate-ack promise bypasses quiet hours.

## Execution stage 17: Internal Communications triage and handoffs

1. Keep Internal Communications always on through the domain policy. Define its role, ranked plain voice and hard no-customer-send limit. Enforce that limit in executable card/channel/dispatch policy, not only in prompts.
2. Reuse the existing Postmark secret check and forwarding hook identity. Parse bounded text; attachments stay ignored in this iteration. Verify the sender before finding the business, dedupe provider email identity and preserve an authenticated source event. Unknown businesses/unsupported messages get a deliberate acknowledgment/drop policy.
3. Implement deterministic triage categories and safe fallback. A model may suggest only allowed categories/active targets and grounded extracted fields; code validates the result and chooses the action. Treat forwarded text as data and keep all calls budgeted.
4. Customer emails become one-off Customer cards. Overdue/supplier material becomes a Bookkeeping handoff; review notifications become Marketing handoffs; unsupported/uncertain work becomes an owner note. No automatic email response or customer-thread merge is introduced.
5. Store a parent/child handoff relation, source event and target skill/contact/invoice identifiers when known. Make retries/fan-out idempotent and avoid handoff loops or duplicate approval cards. Never create an operative child for an inactive target.
6. Freeze handoff contracts with Pramukh. Eric owns triage and dispatch to the receiving module; Pramukh owns amount validation, reminder limits, supplier comparison and Marketing review/post policy. Internal Communications does not implement those policies itself.
7. Support Internal-scoped Ask through the shared validated request context, using code to select brief/triage/renewal work from supported capabilities. Unsupported requests get a clear response; no customer-send action is available.
8. Record receipt, handoff/owner-note result and flags for the brief. Keep source text/links available only inside the owning business and redact logs.
9. Test authenticated versus invalid email hooks, repeated provider events, malicious classification output, inactive targets, unknown source/customer, parent-key visibility, recursive/replayed handoffs and no customer outbox entry from Internal work.

Exit: forwarded items reach the correct selected agent or owner once, without customer sending or model-chosen actions.

## Execution stage 18: daily brief, renewals and scheduling

1. Extend the existing pure `lib/domain/brief.ts` helpers rather than replacing their sample-exclusion rules. Add a server snapshot/query layer that reads pending cards and stake, actual outbox results since the last successful brief, STOP changes, flagged items, relevant events with no card, and renewal reminders.
2. Define the time window, timezone and ranking in code. Exclude invented sample dollars, do not double count a parent/child handoff or one invoice across multiple reminder cards, and keep waiting, approved, queued, sent and copied distinct. Pramukh supplies trustworthy invoice/review facts; Internal reports them without inferring payment status.
3. Persist one brief snapshot/run identity and successful watermark per business/window, plus the next-due time. Concurrent manual/cron runs claim the same work safely. Advance the watermark only after success; retry after failure without losing events or duplicating owner cards.
4. Create one owner-only brief card from that snapshot. Optional model wording uses only code-computed facts and cannot add/change numbers or omit a flagged safety item. Fall back to deterministic text when output is invalid, unavailable or over budget.
5. Add authorized Run now and brief-read interfaces plus a protected scheduled job. New mutation bodies use `readBody`/Zod schemas and get their own middleware rate-limit mapping. Cron verifies `CRON_SECRET` and obtains tenant sessions only from the narrow due-work query.
6. Use business timezone when available, with the existing documented default otherwise. Define run time, local day/DST behavior, bounded batching and overlap handling. A schedule trigger does not by itself guarantee one run.
7. License Clerk reads structured, evidenced license/renewal dates and warning windows from profile facts. Add missing fields through the domain field registry and API intake/profile validation. No guessed dates, auto-renewal, payment or filings. Dedupe reminders by business/license/window and stop them when the owner updates completion/date.
8. Share one code-computed snapshot between Overview, the Internal page and the generated brief. Keep the last successful data readable when a refresh fails. Do not implement independent financial sums in the UI.
9. Coordinate cron ownership: the existing dispatcher remains the sole sender; Customer timers, Internal brief/renewal jobs and Pramukh's weekly Marketing tick run through explicitly assigned jobs/routes. Avoid two schedulers doing the same work, and verify the actual deployment's scheduling cadence.
10. Owner Telegram brief notifications remain stretch scope; they do not follow automatically from owning Internal execution. Keep SMS/phone, direct social publishing and merging email into Telegram threads deferred.
11. Test empty and mixed activity, sample exclusion, deduped financial figures, all flags included, stale/failed runs, concurrent Run now/cron, checkpoint recovery, timezone/DST, renewal warning boundaries/completion, multi-tenant due work and no-AI output.

Exit: the brief and renewal reminders are real, repeatable owner-only work backed by persisted, testable state.

## Execution stage 19: wire the delivered UI and integrate with Pramukh

1. Replace provisional presentation thread/control types with projections of the implemented API contracts. Wire existing `CustomerThreads`, `TelegramSetup`, `AcknowledgmentRule`, `BriefRunButton` and scoped `ChatWindow` through real capability/read/mutation adapters; never pass an ordinary server function through a client callback prop.
2. Remove explicit unavailable messages only when that backend capability actually works. Generate a real local QR, with a single dependency/lockfile owner. Preserve guest-owned access and the read-only shared example.
3. Integrate Pramukh's saved legacy Customer-id migration compatibly and remove temporary aliases only after current records, both teammates' code and the UI pass. Bookkeeping and Marketing keep their canonical identities and enabled-skill behavior.
4. Integrate Pramukh's billing handoff receiver, paid-invoice/finished-job event producer, review flag/result data and shared Telegram delivery use through the frozen contracts. Test those interfaces with fake producers/consumers while his branch is unfinished, then repeat against the actual merged implementation.
5. Pramukh retains overdue/paid invoice policy, cancellation, reminder limits, supplier extraction, Marketing scheduling/content policy and review retention. Eric implements Customer follow-ons and Internal reporting; shared hooks/scheduler/store changes go through the agreed writer.
6. Preserve all existing pages, automation URLs, comparison/adoption flow, one approval queue and the model-writes-text/code-decides invariant. Document any new deployment-wide Store exceptions and authorized send provenance in architecture/security docs as part of the same change.

Exit: Eric's two execution flows and UI are live against their own backend, with explicit tested boundaries to agents 2 and 3.

## Execution stage 20: final verification and delivery

1. Run appropriate pure-policy, fake-fetch connector, memory/Supabase parity, RLS/migration, schema/rate-limit, webhook, server orchestration and component tests. Tests/build require no live secrets; provider integration checks are reported separately.
2. Under Node 26, merge current main into the integration branch when Git authentication allows it and run `npm run check` on that exact tree. A previous frontend checkpoint pass is not evidence the new execution code passes.
3. Browser-test onboarding/general Chat for StrictMode and workspace-switch regressions, all preserved pages/URLs and desktop/phone/container widths. Verify API errors show actual unavailable/retry states rather than fixture success.
4. In an explicitly authorized test environment with controlled recipients, verify guest business creation, Telegram start/message, one thread turn/draft, owner approval, real delivery, rule authorization/audit, quiet-hours hold, STOP/block, allergy lock, provider failure and deletion eligibility. A prior automatic review rejected the browser email-approval click; do not retry or bypass that rejection through another tool. Obtain the required approval or approved safe test conditions before consequential provider actions.
5. Verify forwarded customer/supplier/review emails route once, incomplete/inactive targets stay owner notes, the Internal brief reflects all results, Run now/cron dedupe and license reminders use actual facts.
6. Verify a typed paid-invoice event from Pramukh cancels his reminders and creates Eric's appropriate Customer follow-on once; Internal reflects the result. No invented invoice linkage or hidden cross-agent sends.
7. Update README, environment examples, migrations, architecture/security notes and the demo walkthrough to actual behavior. Rehearse/record the video only after the real and simulated parts are labeled and verified.
8. Follow the repository PR landing workflow. Do not push/merge from a stale main or claim external delivery from component tests. No application implementation or next worker wave is started by this document revision.

## Stage dependencies and three-worker execution

| Work | Implementation owner | Can proceed independently? | Integration prerequisite |
| --- | --- | --- | --- |
| Shared contracts/store/safety/orchestrator foundation | Pramukh groundwork first; Eric coordinator for Customer/Internal extensions | Yes, once ownership and interfaces are recorded | Both stores/migrations and stable typed seams |
| Customer execution, stages 14-16 | Eric worker 1 | Focused modules/fake-fetch tests can start against frozen contracts | Foundation, configured Telegram and centralized send wiring |
| Internal execution, stages 17-18 | Eric worker 2 | Policy/jobs/snapshot tests can start against frozen contracts | Foundation, event/due-work queries and parent/child contract |
| Existing UI/control completion and adapters | Eric worker 3 | Fixtures and component tests can proceed now | Real Customer/Internal APIs for live wiring |
| Bookkeeping/Marketing execution | Pramukh | His focused handlers/tests can proceed against the same interfaces | Shared writer integrates his requested hooks/types/store operations |
| Cross-agent integration and real-provider demo | Eric coordinator with Pramukh | Requires both relevant implementations | Controlled test recipients, configuration, authorization and final merged-tree checks |

## Decisions and remaining coordination

The execution split is settled: Eric implements product agents 1 and 4; Pramukh implements product agents 2 and 3. Eric retains the existing UI/documentation/demo responsibility. Three Eric implementation workers mean Customer execution, Internal execution and UI integration; they are not the four product agents.

Before code changes resume, adopt Pramukh's shared-groundwork and configuration ownership, record one writer for each subsequent shared patch, and freeze cross-agent handoff/payment/review/event contracts, and settle command-confirmation authorization, shared-bot STOP/restart/rebind scope, rule frequency/revocation, brief time windows, structured renewal facts and provider retry/recovery behavior. These are concrete implementation decisions within the agreed ownership, not a reason to reconsider the split.

Completion now includes real Customer and Internal server execution, data isolation, authorization, persistence, scheduled jobs and integrated UI. Prepared controls or unavailable states alone do not complete the expanded scope. Bookkeeping/Marketing execution remains Pramukh's responsibility; infrastructure supporting Eric's two agents is no longer deferred wholesale to him.

## Consolidation addendum: V2 interfaces and migration order

Pramukh provides `createHandoffCard` in `lib/server/handoff.ts`, `receiveSupplierInvoice` in `lib/server/supplier-invoice.ts`, Bookkeeping/Marketing reads, validated agent-scoped Ask, and deployment cron/environment integration. Eric provides Telegram/thread/flag helpers, Customer/Internal request handlers, the brief job and all UI adapters. Preserve no-AI behavior and capability checks for every caller. Freeze exact signatures and idempotent source keys before live integration. A helper returning no eligible card must lead to an owner note or clear no-handler result, never a silent send.

Proposed migration slots at the inspected checkpoint: Pramukh `20261108000300_agent_groundwork.sql`; Eric `20261108000400_telegram_threads.sql`; Pramukh `20261108000500_bookkeeping.sql` and `20261108000600_marketing_reviews.sql`. Verify against fetched main and assign later Internal run/renewal slots. Shared parent-key groundwork must precede dependents; `stake` already exists in draft/storage and must not be duplicated blindly. Never modify a merged migration.

Keep `workflows/[workflow]/page.tsx` and the nested existing automation route. V2's suggested folder rename is unnecessary because the delivered UI already preserves both URL depths. QR or renewal scheduling reductions need an explicit scope decision and truthful demo labeling, not an implicit declaration of completion.
