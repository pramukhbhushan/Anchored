# Eric's three-agent work split

## Verified starting point

Worktree: `/Users/ericwei/Anchored/.claude/worktrees/eric-agent-dashboard`.
Branch: `feat/agent-dashboard`. Original project checkout is unchanged.

The current presentation milestone is implemented. Start from its checkpoint, not from the original plan's assumption that nothing exists.

- Active-agent workspace routes use the existing Workflows directory. Existing automation URLs, map, top-level navigation and single Approvals queue are preserved.
- Customer groups legacy Front Desk/Follow-up for presentation; canonical labels and niche agents are supported without migrating stored records.
- Navigation, Overview entry points, draft previews and recent activity use the existing domain/feed reads.
- Chat context, customer threads, Telegram setup, acknowledgment controls and brief refresh components have isolated tests. New backend-dependent functionality remains unavailable in production.
- Approval/copy race handling, superseded labels, history deep links, malformed hashes and onboarding/chat StrictMode handling are covered.
- Node 26 `npm run check` passes: 101 test files, 1,189 tests, then production build.
- Browser checks: 12 pages at 1440, 1024, 768 and 390px, all successful with no document overflow or page exceptions. Expanded/collapsed sidebar selection, command palette, mobile drawer, existing automation page, active Bookkeeping selection and workspace-to-approval anchors were verified.
- The automated approval reviewer rejected the browser's Approve: Send email click because it could contact a customer. It was not performed. Approval behavior is covered by automated tests; browser mutation and external delivery are not verified.

## Operating agreement

Use three workers with one coordinator. The coordinator owns the shared interface decisions, integration, final full check and browser verification. Workers own their assigned feature files and colocated tests. They do not expand into server implementation or change the app structure.

Each worker branches from the same verified local checkpoint, using a separate worktree and port. Suggested branches: `feat/agent-workspace-finish`, `feat/agent-owner-controls`, `feat/agent-approvals-brief`. Do not branch independently from stale `origin/main` and lose the delivered work. Before pushing a PR, refresh/merge `origin/main` and rerun checks under the repository landing workflow. GitHub SSH authentication currently prevents that remote refresh.

No need to wait for another worker to finish implementation: each reads frozen shared types and tests its own views against fixtures. Final live wiring still depends on actual backend capabilities. Do not invent successful API responses, silently replace errors with fixtures, or send to an unconfirmed endpoint.

## Agent 1: workspaces and customer conversations

Own:

- `app/app/b/[id]/workflows/[workflow]/page.tsx`, `loading.tsx`, `error.tsx`, `page.test.tsx`.
- `components/business/agents/AgentWorkspace.tsx`, its test and `agents.module.css`.
- `components/business/agents/CustomerThreads.tsx`, its test and `customer-threads.module.css`.
- Additional test-only workspace/thread fixtures in that feature folder, named distinctly.

Remaining work:

1. Audit the delivered workspace against the design without rebuilding it. Keep one-segment agent and two-segment automation URL semantics intact.
2. Complete any missing empty/loading/partial-error, long-text, niche-agent, handoff and activity-state presentation coverage.
3. Validate Customer query selection, Back/Forward, stopped/locked history, message ordering and bounded history semantics against the eventual server contract.
4. Keep customer history read-only and send every decision to the same Approvals queue.
5. Accept Agent 2's Ask/setup exports and Agent 3's brief export through documented component props/slots. Assemble them in the page only when the backing capability is real.
6. Keep unavailable states until authorized server reads exist. Report exact missing fields/functions to the coordinator instead of editing `lib/**`.
7. Finish workspace-specific keyboard, narrow-container and screen-reader checks.

Done when: workspace and thread components pass their behavior tests, old URLs remain valid, and live data either works through the agreed interface or has a truthful unavailable state. The agent must report separately which paths remain server-dependent.

## Agent 2: Ask, Telegram setup and owner rules

Own:

- `components/chat/ChatWindow.tsx`, its tests, `starters.ts` and chat CSS if necessary.
- `components/connections/TelegramSetup.tsx`, its tests and `telegram.module.css`.
- `components/connections/AcknowledgmentRule.tsx`, its tests and `rule.module.css`.
- `components/connections/ConnectionsPanel.tsx`, `ContactsList.tsx`, their tests and connections CSS for compatible presentation changes only.
- `app/app/b/[id]/connections/page.tsx`, its loading/error files and tests.
- New feature-local browser API adapters only after their endpoint contract is agreed.

Remaining work:

1. Preserve the verified StrictMode and business/agent-switch isolation behavior in ChatWindow. Do not reintroduce duplicate intake creation or stale responses.
2. Complete agent-specific starter/accessible context presentation using enabled skills. General Chat must still send only `text`; scoped Ask is enabled only when the server validates its context.
3. Connect a real server-provided Telegram test link independently of permissions to connect secret-bearing services, when that read exists.
4. Finish real local QR generation only after the coordinator assigns dependency and lockfile ownership. Current `qrCode` is a rendering slot, not a generated QR.
5. Preserve explicit acknowledgment authorization, saved versus attempted state, failure recovery and STOP/quiet-hours wording.
6. Preserve existing email/Stripe forms and contact management. Do not implement Telegram bindings, consent rules or sends in components.
7. Test client-adapter requests at fetch once their exact schemas exist; report unavailable interfaces rather than inventing routes.

Done when: Ask/setup/rule views and supported adapters pass tests, onboarding/general Chat remain intact, and guest-owned versus shared-example behavior follows actual server capabilities.

## Agent 3: approvals, brief, Overview and delivery documentation

Own:

- `app/app/b/[id]/approvals/**` and `app/app/b/[id]/page.tsx` with its test.
- `components/business/AgentCard.tsx`, `handoff.ts`, `SendYourself.tsx`, `OpenFromHash.tsx`, their tests.
- `components/business/agents/BriefRunButton.tsx` and its test.
- Additional feature-local delivery/brief presentation components and styles if necessary.
- `README.md` and `MD_files/Eric Agent Demo Walkthrough.md`.

Remaining work:

1. Retain the delivered copy/approval lock, truthful copy failure, superseded state, history anchor and unsafe Telegram fallback fixes.
2. Once real API types exist, connect Telegram outbox presentation to actual delivery status and recipient display names. Replace provisional presentation channel extensions with agreed types.
3. Add rule-authorization audit labels and sent-message deletion controls only with server-provided authorization, eligibility and an agreed endpoint. Do not infer eligibility from client time.
4. Connect the brief control and Overview to one code-computed server snapshot, preserving the last successful brief on failure. Do not compute financial policy or scheduling in React.
5. Keep Marketing copy distinct from publishing, and preserve exact edited/approved text and safe destination links.
6. Update the README/demo walkthrough to match what is actually connected; label simulated and unavailable features. Do not claim external delivery or a finished video without evidence.
7. Prepare approval/brief scenario tests and the coordinator's final integration checklist. Leave customer-contacting browser actions unperformed unless specifically authorized or proven safe through an approved review.

Done when: the single queue/outbox and Overview/brief behavior is correct, supported actions use the agreed contract, and documentation accurately distinguishes tested UI from live provider behavior.

## Shared files reserved for the coordinator

Workers read but do not independently edit:

- `components/routes.ts`, shell navigation/data/location files and their shared tests.
- `components/business/agents/view-model.ts`, its base fixtures and test.
- `components/agent-labels.ts`, `components/view-helpers.ts`.
- `components/site/**` and workflow presentation compatibility already delivered in this checkpoint.
- `app/globals.css`, package manifests/lockfile, shared `test/**` and test/build configuration.
- `components/business/agents/integration.md` and this assignment document.

Request a small coordinator patch when needed. This avoids all three agents editing shared mappings, navigation, global CSS or dependency files.

## Backend boundary and order of integration

All three assignments remain within Eric's scope. They do not authorize edits to `lib/domain`, `lib/api`, `lib/server`, `lib/store`, `lib/connectors`, `app/api`, migrations, middleware, cron or secrets. Pramukh is not currently implementing those features, so there is no existing agent contract to assume.

To complete live Telegram, customer threads, rule saves, scoped Ask, paid-invoice cancellation and scheduled/on-demand briefs, a separate backend implementation is still required. Merely adding more frontend agents cannot supply those capabilities. The coordinator should explicitly agree any ownership transfer before adding a backend worker.

Integration sequence:

1. Freeze the current shared presentation exports and list missing backend contracts.
2. Let all three workers finish their own UI/tests independently.
3. Coordinator resolves shared-file requests, then assembles exported components in Agent 1's page after the worker's handoff.
4. Once backend interfaces exist, each worker connects its owned adapters to those exact types and errors.
5. Coordinator merges worker changes into the integration branch, runs Node 26 `npm run check`, reviews the combined diff, and verifies the preserved app flows in a browser.
6. Verify the real guest-owned-business and provider flow only with the configured backend and authorization for consequential actions. Keep automation tests and actual provider evidence distinct.

This document divides the remaining work. No new three-worker implementation wave is dispatched as part of finishing the current verification stage.
