# Architecture

Anchored is a Next.js 15 App Router app in TypeScript. Its code sits in layers, and each layer may import only the layers below it. [`lib/architecture.test.ts`](../lib/architecture.test.ts) reads every import in the repo and fails `npm test` when one breaks a rule, naming the file, the import and the rule.

The point of the layers is that the decisions that matter to a small business owner, such as which workflows apply, what a tool scores and whether a text may go out, live in plain functions that a test can call with no server, database or model.

## The layers and what each may import

The table lists the layers from the bottom up. A file may always import its own layer.

| Layer | What it holds | May import |
| --- | --- | --- |
| `lib/domain/` | Workflows, agents and skills, the tool catalog, ratings, the rules engine, the example business, card templates, and the executor's `checkSend` | `zod` only |
| `lib/api/` | `contract.ts`, the request and response types of every API route, and `schemas.ts`, the Zod schema for every request body | `lib/domain` and `zod` only |
| `lib/llm/` | The model layer: the `LlmProvider` interface and one adapter per provider | Anything except `lib/server`, `lib/store`, `lib/api`, `lib/auth`, `next` and `react` |
| `lib/connectors/` | One adapter per connected service: Twilio texts and calls, Resend email out, Postmark email in, Stripe invoices. Each turns one send or one webhook into plain values | Anything except `lib/server`, `lib/store`, `lib/api`, `lib/auth`, `lib/llm`, `next` and `react` |
| `lib/store/` | The `Store` interface, with `SupabaseStore` for Postgres and `MemoryStore` for local runs | Anything except `lib/server`, `lib/llm`, `lib/auth`, `next` and `react` |
| `lib/auth/` | Supabase Auth clients, the sign-in paths, and the `Viewer` type | Anything except `lib/server`, `lib/store` and `lib/llm` |
| `lib/server/` | Server-only orchestration: the session, data reads, model calls under a daily budget, card decisions, the scheduled sender, turning events into cards, and request parsing | Any `lib` layer |
| `components/` | React components, grouped by feature | Anything except `app/` and `middleware.ts` |
| `app/` | Pages under `app/app/`, the marketing site, and API routes under `app/api/` | Anything except `middleware.ts` |

No file under `lib/` imports `app/`, `components/` or `middleware.ts`. Three more rules cut across the layers:

- A file marked `"use client"` never imports `lib/server`, `lib/store`, `lib/llm`, `lib/connectors`, `lib/auth/server` or `server-only`. Client files ship to the browser, and the service-role store must never reach it.
- The modules that `middleware.ts` shares with the server and the browser import nothing at all: `lib/session-cookie.ts`, `lib/auth/config.ts`, `lib/auth/paths.ts`, `lib/auth/session-id.ts`, `lib/auth/viewer.ts`, `lib/server/origin.ts` and `lib/server/rate-limit.ts`. Middleware runs on the edge runtime, where most server code can't load.
- Nothing imports `middleware.ts`. It is an entry point, so code that a route shares with it lives in `lib/server` or `lib/auth`.

Type-only imports count. A layer that names another layer's types depends on that layer as much as one that calls its functions.

When the test fails, move the code to the layer that owns it. If the design itself changed, edit the `RULES` table at the top of the test in the same pull request, so the reviewer sees the rule change next to the code that needs it.

### How components are grouped

`components/` holds one folder per feature and a few shared modules:

- `ui/` holds the primitives that both the site and the app use, such as `Button`, `Card`, `Badge`, `Toast` and `PageSkeleton`.
- `site/` holds the marketing pages' pieces, and `shell/` holds the app's sidebar, top bar and command palette.
- `business/` holds the pieces of the business pages under `/app/b/[id]`, and `stack/` holds the Stack page's.
- `chat/`, `account/`, `onboarding/` and `resize/` each hold one feature.
- The root holds four shared modules and nothing else. `api.ts` wraps `fetch` for client components, `routes.ts` builds URLs, and `view-helpers.ts` and `agent-labels.ts` hold pure helpers for the views.

## How a request moves through the layers

Every request passes through `middleware.ts`, which assigns the session, refuses cross-site and oversized API writes, and applies the rate limits. A page or an API route then asks `lib/server` for what it needs, and `lib/server` calls the layers below it.

```mermaid
flowchart LR
  browser[Browser] --> mw["middleware.ts<br/>session, origin check, rate limits"]
  mw --> page["Page<br/>app/app/b/[id]/*/page.tsx"]
  mw --> route["API route<br/>app/api/**/route.ts"]
  route -. "parses the body with" .-> api[lib/api]
  page --> server[lib/server]
  route --> server
  server --> domain[lib/domain]
  server --> store[lib/store]
  server --> llm[lib/llm]
  server --> connectors[lib/connectors]
```

Approving a card shows the whole path. `POST /api/cards/[id]` parses the body with `readBody` and `decideCardSchema`, then calls `decideCard` in `lib/server/decide.ts`. `decideCard` runs `checkSend` from `lib/domain/executor.ts`, writes the decision through `Store.updatePendingCard`, and writes the outbox row through `Store.addOutbox`.

Business pages read the same way. `app/app/b/[id]/layout.tsx` looks up the business before any `loading.tsx` boundary streams, so an unknown id returns a real 404. Each page then calls `getBusinessOrNotFound`, `getChoices` and `getFeed` from `lib/server/data.ts`, and React `cache` makes the layout and the page share one lookup.

## The invariants

These hold everywhere in the code. A change that breaks one is a design change, not a refactor.

**The model writes text, and code decides.** `planWorkflows` in `lib/domain/engine.ts` picks the workflows, `pathOptions` and `defaultChoice` in `lib/domain/paths.ts` pick the paths, `rateTool` in `lib/domain/rating.ts` computes every score, and `readRequest` in `lib/domain/requests.ts` decides whether a business chat message asks for work and which chosen skill drafts it. `starterSkills` in `lib/domain/starters.ts` picks which skills get a written starter draft. The model features in `lib/server/ai.ts`, `lib/server/intake-ai.ts`, `lib/server/business-chat.ts` and `lib/server/starters.ts` only write or rewrite text or read chat answers, and code validates each reply against the allowed values. With no provider configured, or past the daily budget in `lib/server/ai-budget.ts`, the rules run instead.

**`checkSend` gates every send.** `decideCard` is the only caller of `Store.addOutbox`, and it runs `checkSend` before every write. `checkSend` refuses a locked thread, an allergy answer, an unfilled `[placeholder]`, and a text with no opt-out line, no consent, or a send time in quiet hours. When quiet hours are the only problem, `decideCard` queues the text for the first hour that passes.

Each outbox row carries a `delivery`: `yours` when the owner sends it from their own phone or email, or `queued`, `sending`, `sent` and `failed` when Anchored sends it. `deliveryFor` in `lib/domain/contacts.ts` picks Anchored only when the business has connected the service, and then texts only a number with a consent record and no STOP reply, and emails only a real address. The dispatcher in `lib/server/dispatch.ts` sends queued rows through the adapters in `lib/connectors/` and runs `checkSend` again at send time, since a queued text can cross into quiet hours and a customer can text STOP after the owner approves.

**Every `Store` query filters by session.** Every `Store` method takes the session id first, and `SupabaseStore` filters each query on `session_id`. Three methods work across the deployment on purpose: `useAiCall` counts model calls, `listDueOutbox` gives the scheduled sender every queued row that is due, and `findConnection` lets a webhook find its business by hook id. The shared Telegram bot adds narrowly scoped methods, since its webhook knows only a chat id, an update id or the hook id in a customer link: `findTelegramHook` and `findTelegramChat` return the owning session with the business or chat, `setTelegramChatBlocked` records a customer blocking the bot, and `claimTelegramUpdate`, `telegramUpdateDone` and `finishTelegramUpdate` distinguish completed updates from busy or recoverable work. `listBriefTargets` supplies bounded business/session pairs to the brief and recorded-work schedulers. Every lookup that returns a row returns its session id, and the caller uses that id for every later call. `docs/security.md` covers the row-level security that backs this up.

**Migrations are append-only.** A file in `supabase/migrations/` never changes after it merges. A schema change is a new file with a later timestamp, as `20261107000400_retention_keeps_accounts.sql` shows by replacing a function that an earlier migration created.

**The contract and the schemas agree.** Each schema in `lib/api/schemas.ts` `satisfies` its request type from `lib/api/contract.ts`, so a field that drifts between them fails `tsc`.

## Where to add things

TypeScript does much of the bookkeeping. Most catalogs are `Record` types keyed by a union, so adding a member to the union makes `tsc` list every table that needs an entry.

| To add | Start here | Then |
| --- | --- | --- |
| A workflow | Add its id to `WorkflowId` in `lib/domain/types.ts`. | Fill the entries `tsc` asks for: `WORKFLOWS` in `lib/domain/workflows.ts`, `WORKFLOW_SKILLS` in `lib/domain/agents.ts` and `TOOL_STEPS` in `components/workflows/copy.ts`. Add the rule that matches it in `planWorkflows` in `lib/domain/engine.ts`, with a test in `engine.test.ts`. |
| A profile detail | Add it to `ProfileDetails` in `lib/domain/types.ts`. | Fill `FIELDS` in `lib/domain/fields.ts` with the agents that need it and its gap question, `FORMATS` in `lib/server/extract.ts`, and its case in `parseDetail` and `detailText` in `lib/domain/details.ts`. Readiness, gap questions and the Profile page pick it up from the registry. |
| A skill | Add its id to `SkillId` in `lib/domain/types.ts`. | Fill `SKILLS` in `lib/domain/agents.ts`. Add a card template to `CARD_TEMPLATES` in `lib/domain/cards.ts` if the skill drafts cards. For the model to write its starter, add it to `WRITABLE_SKILLS` and `STARTER_RECIPIENT` in `lib/domain/starters.ts` and `MOMENTS` in `lib/server/starters.ts`. |
| A tool | Add an entry to `TOOLS` in `lib/domain/catalog.ts`. | `rateTool` scores it against each business with no other change. |
| A tool for the review queue | Run `npm run discover`. `scripts/discover.ts` calls `discoverTools` in `lib/server/discover.ts`. It gets pages from `LlmProvider.searchWeb` when the provider has it, or else loads the websites the model names with `fetchPage` in `lib/server/fetch-page.ts`, and keeps only what `vetCandidates` in `lib/domain/discovery.ts` passes. | Review the new entries in `lib/domain/discovered.json`. When a person has checked a tool's facts, move it to `TOOLS` and remove it from the file. |
| A model provider that speaks the OpenAI API | Add its name to `ProviderName` in `lib/llm/types.ts` and to `PROVIDERS` in `lib/llm/config.ts`. | Fill `LABELS` and `BASE_URLS` in `lib/llm/config.ts` and `DIALECTS` in `lib/llm/openai-compatible.ts`. |
| A model provider with its own API | Write an adapter that implements `LlmProvider`, as `lib/llm/anthropic.ts` does. | Choose it in `providerFor` in `lib/llm/index.ts`. Features keep calling `getBudgetedLlm` and never import a vendor SDK. |
| A business page | Add a folder under `app/app/b/[id]/` with `page.tsx`, `loading.tsx` and `error.tsx`. | Add the section to `Section` and `SECTIONS` in `components/routes.ts`, then fill `SECTION_ICON` in `components/shell/nav.ts`. Put the page's components in a feature folder under `components/`. |
| An API route | Add the request and response types to `lib/api/contract.ts` and a schema that `satisfies` the request type to `lib/api/schemas.ts`. | Write `app/api/.../route.ts` to parse with `readBody` and call `lib/server`. Give it a rate limit in `limitFor` in `middleware.ts` if it calls a model or creates rows. |
| A connector | Add the adapter under `lib/connectors/` with a test that hands it a fake `fetch`, and a kind to `ServiceKind` and `SERVICE_KINDS` in `lib/domain/connections.ts`. `ConnectionKind` is `ServiceKind` plus `ai`, the owner's AI key, which saves through its own route. | Add a webhook route under `app/api/hooks/` that verifies the provider's signature and finds the business with `Store.findConnection`, and the delivery branch in `lib/server/dispatch.ts`. |
| A migration | Add `supabase/migrations/<timestamp>_<what>.sql` with a later timestamp than every other file. | Turn on row-level security for a new table. Add any new query to the `Store` interface in `lib/store/types.ts` and to both `MemoryStore` and `SupabaseStore`, with a test in `memory.test.ts`. |

## Known gaps

The rules describe the code as it is, and two places sit below the bar the layers set.

- Several API routes call `getStore()` directly for one read or write, such as `setChoice` or `recordEvent`. The intake route in `app/api/intake/[id]/route.ts` goes further and runs a multi-step flow that belongs in `lib/server`. Moving it there would leave every route as parse, call and answer, as the ingest flow already is: it lives in `lib/server/ingest.ts`, which the simulator route and the webhooks share.
- `components/shell/shell-data.ts` is a server module that lives in `components/`, because it reads the data only the app shell shows.

The four agent workspaces, what each drafts and what starts it are in [agents.md](agents.md).
