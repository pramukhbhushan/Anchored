# Anchored agent guide

Anchored helps small business owners find, compare and adopt AI tools. Where no tool fits a job, an approve-first agent drafts the work as cards and sends nothing until the owner approves each one.

The users are small business owners, such as an HVAC contractor or a corner store owner, not engineers. Write every owner-facing string in plain words: say what happened, then what to do next. The refusals in `checkSend` (`lib/domain/executor.ts`) set the tone, for example "Quiet hours: texts wait until 8 a.m."

## Commands

Use Node.js 26, the version in `.nvmrc`.

| Command | Runs |
| --- | --- |
| `npm run dev` | The dev server on port 3000. Another person's dev server may already hold it; check your own work as in [Working in parallel](#working-in-parallel) |
| `npm test` | Vitest: `*.test.ts` files run in Node, `*.test.tsx` component tests run in happy-dom |
| `npm run typecheck` | `next typegen` for the route types, then `tsc --noEmit` |
| `npm run build` | `next build` |
| `npm run check` | The type check, the tests, then the build. CI in `.github/workflows/ci.yml` runs the same steps on every PR and every push to `main` |
| `npm run discover -- --workflow <id> --business "<kind>"` | The discovery agent: finds tools that do one workflow, keeps the ones a real page backs, and appends them to `lib/domain/discovered.json` for a person to review. Works with any AI provider. Set `AI_MODEL_COMPLEX` to a large model, or use `AI_PROVIDER=anthropic` to search the web |

A fresh worktree has no `.env.local`, so it runs with accounts off, AI off and data in memory, and the rules draft every profile and card. Production on Vercel runs with Supabase for data and sign-in; the README's "Deploy to Vercel" lists the settings. The tests and the build need no keys. AI turns on with `AI_PROVIDER`, one `AI_API_KEY` and an optional `AI_BASE_URL`, the same names for every provider. The README's AI provider table lists the model settings. A production server with no Supabase settings throws on its first data read; `ANCHORED_ALLOW_MEMORY_STORE=1` lets it run on the in-memory store instead.

## Where things live

Each layer imports only the layers below it: `lib/domain` at the bottom with `zod` alone, then `lib/api`, `lib/llm`, `lib/store`, `lib/auth` and `lib/server`, with `components/` and `app/` on top. [`lib/architecture.test.ts`](lib/architecture.test.ts) fails `npm test` on any import that breaks a rule. [`docs/architecture.md`](docs/architecture.md) holds the full rule table and a "Where to add things" table; read it before you add a module, a cross-folder import, or a new workflow, skill, tool, provider, page, route or migration.

| Path | Holds |
| --- | --- |
| `lib/domain/` | Pure rules: workflows, agents, the catalog, ratings, cards, the executor |
| `lib/llm/` | The provider-agnostic model layer, one adapter per provider |
| `lib/store/` | Persistence behind the `Store` interface, with a Supabase and an in-memory backend |
| `lib/server/` | Server-only orchestration: sessions, model calls, card decisions, route helpers |
| `lib/api/` | API request and response types, and the Zod schema for every request body |
| `lib/auth/` | Supabase Auth clients, the sign-in paths and the `Viewer` type |
| `app/` | Routes. The product is under `app/app/`, served at `/app`. The API is under `app/api/` |
| `components/` | `ui/` primitives, `shell/` app chrome, `site/` marketing pages, `business/` business pages, `stack/` the Stack page, and `onboarding/`, `chat/`, `account/` and `resize/`. The root holds only `api.ts`, `routes.ts`, `view-helpers.ts` and `agent-labels.ts` |
| `test/` | Shared component test setup: the DOM environment, `next/navigation` mocks, `fetch` helpers and fixtures |
| `supabase/migrations/` | The database schema, one SQL file per change |
| `docs/security.md` | Each security control and the file that holds it |
| `docs/research/` | The team's research by trade. Its `README.md` lists every file |
| `docs/prototype/` | The single-page prototype the app was ported from |

## Invariants

Each rule protects an owner's customers or data, and breaking one can pass every other test. Before you change code a rule names, read its section in [`docs/architecture.md`](docs/architecture.md#the-invariants) or [`docs/security.md`](docs/security.md).

- **The model writes text only.** Code decides every workflow, path, score and send, and validates each model reply before using it. `lib/server/ai.ts`, `intake-ai.ts` and `business-chat.ts` hold the model features. When an owner asks for work in the business chat, `readRequest` in `lib/domain/requests.ts` picks the skill from the ones they chose, and the model writes only the draft's words.
- **`checkSend` gates every send.** `checkSend` in `lib/domain/executor.ts` enforces quiet hours, the allergy lock, the opt-out line, unfilled `[placeholders]` and consent. `decideCard` in `lib/server/decide.ts` runs it, and is the one code path that writes to the outbox.
- **Card decisions and rewrites go through `Store.updatePendingCard`.** It writes only while the card is still pending, so a double tap decides and sends once.
- **Every `Store` method filters by session.** Each one takes the session id and filters on it. Callers get the id from `getSessionId` in `lib/server/session.ts`, not from request input. `useAiCall`, the daily model call counter, is the one deployment-wide method. A new method lands in `lib/store/types.ts`, `memory.ts` and `supabase.ts` together, and `reset`, which "Delete my businesses" runs, clears any table it adds.
- **Every model call goes through `getBudgetedLlm`** in `lib/server/ai-budget.ts`, which counts it against `AI_DAILY_CALL_CAP`. `getLlm` from `lib/llm` has that one caller.
- **Server code imports `server-only`.** Each `lib/server` and `lib/llm` module that reads a secret or calls the store or a provider starts with `import "server-only"`, so a client component that imports it fails the build. The edge middleware's helpers import nothing at all: `lib/server/origin.ts`, `lib/server/rate-limit.ts`, `lib/session-cookie.ts` and `lib/auth/{config,paths,session-id,viewer}.ts`. The layer test enforces that list.
- **Migrations are append-only.** Name a new one `YYYYMMDDHHMMSS_name.sql`, with a timestamp after the newest file on `main`. Once merged, a migration is frozen; change the schema with a new file.
- **Rate-limit each new API mutation in `middleware.ts`.** A route that calls a model or creates rows gets its own entry in `LIMITS` and a match in `limitFor`; any other falls into the shared `mutation` bucket. The route reads its body through `readBody` in `lib/server/http.ts` with a schema from `lib/api/schemas.ts`.

## UI rules

The owner wants every page to use the whole screen and adapt to it. `app/globals.css` holds the tokens.

- **Fill the width.** Give pages and sections no `max-width`; lay repeated items in grids with `repeat(auto-fill, minmax(min(100%, <n>px), 1fr))`, and switch layouts with `@container app` queries, since the sidebar changes the space. Cap only running text, at about `65ch`. Phones get one column with no sideways scroll.
- **Spacing and type come from tokens:** `--s-1` to `--s-8` (4 to 64px; 12px inside a card, 16 to 24px between cards, 48px between sections), `--pad` for card padding, and the seven `--fs-*` sizes.
- **Say each thing once per page.** One filled button per region, at most one badge per card, boxes only for things the owner decides (approval cards, the brief, the bill), and secondary detail behind a `<details>`. Carbon yellow marks only the brief, the owner's OK step on the Workflows graph, the active nav item and the approvals count. Owner-facing pages say who handles each job ("Your OpenTable sends reminders", "Anchored drafts it, you approve") and never use the internal path names Turn on, Buy, Build or Skip; those stay in `lib/domain` and on the marketing pages.

## Working in parallel

Several teammates and agents work at once, each in its own git worktree on its own branch, and all of it lands on `main`.

1. Agree with the person directing you on the files you own before you start. Edit only those. When your change needs a file someone else owns, ask that person.
2. Run `git fetch origin`, then branch from `origin/main`. Name the branch `feat/`, `fix/`, `docs/`, `refactor/` or `ci/` plus a short slug, such as `fix/quiet-hours-dst`.
3. Run `npm ci`. A fresh worktree has no `node_modules`.
4. Check your work in a browser on a port of your own. Leave port 3000 to whoever runs `npm run dev`.

   ```bash
   npm run build
   ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p 3101
   ```

   Pick a port no other agent is using.
5. To push, open a PR or merge, follow [`.claude/skills/land-a-pr/SKILL.md`](.claude/skills/land-a-pr/SKILL.md) step by step: merge `origin/main` into your branch, pass `npm run check` on the merged tree, then open the PR. Work reaches `main` only through a PR, and `main` has no branch protection, so that check is the only gate.

## Conventions

- Commit messages follow Conventional Commits 1.0.0: `type(scope): description`, lowercase, present tense, no trailing period. `git log --oneline` shows the scopes in use.
- Commits and PRs carry no AI attribution, such as a `Co-Authored-By` trailer for a model or a "Generated with" footer.
- Code comments, docs, commits and UI copy separate clauses with a period or a comma. They contain no em dashes or en dashes.
- Quotes are straight. Headings are sentence case.
- Each file has a `Module Overview` banner below its imports: a short comment paragraph on what the file does. `lib/domain/executor.ts` shows the shape.
- Each exported function has a one-line `/** */` doc comment above it.
- Tests sit beside the code: `<name>.test.ts` for logic, `<name>.test.tsx` for components. Component tests assert what an owner sees and does (roles, accessible names, links, the request sent), never class names, so a restyle keeps them green. Mock the network only at `fetch` with the helpers in `test/http.ts`; `test/setup-dom.ts` and `test/next.ts` cover the DOM setup and `next/navigation`.
