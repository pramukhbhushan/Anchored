# Anchored agent guide

Anchored helps small business owners find, compare and adopt AI tools. Where no tool fits a job, an approve-first agent drafts the work as cards and sends nothing until the owner approves each one.

The users are small business owners, such as an HVAC contractor or a corner store owner, not engineers. Write every owner-facing string in plain words: say what happened, then what to do next. The refusals in `checkSend` (`lib/domain/executor.ts`) set the tone, for example "Quiet hours: texts wait until 8 a.m."

## Commands

| Command | Runs |
| --- | --- |
| `npm run dev` | The dev server on port 3000, which belongs to the lead. Check your own work as in [Working in parallel](#working-in-parallel) |
| `npm test` | Vitest, over the `*.test.ts` files beside the code |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `next build` |
| `npm run check` | The type check, the tests, then the build. CI in `.github/workflows/ci.yml` runs the same steps on every PR |

A fresh worktree has no `.env.local`, so it runs with AI off and data in memory, and the rules draft every profile and card. The tests and the build need no keys. A production server with no Supabase settings throws on its first data read; `ANCHORED_ALLOW_MEMORY_STORE=1` lets it run on the in-memory store instead.

## Where things live

[`docs/architecture.md`](docs/architecture.md) defines the layers and which may import which, and a test in `lib/` fails when an import breaks a rule. Read it before you add a module or an import that crosses folders.

| Path | Holds |
| --- | --- |
| `lib/domain/` | Pure rules: workflows, agents, the catalog, ratings, cards, the executor. It imports only other `lib/domain` files |
| `lib/llm/` | The provider-agnostic model layer, one adapter per provider |
| `lib/store/` | Persistence behind the `Store` interface, with a Supabase and an in-memory backend |
| `lib/server/` | Server-only orchestration: sessions, model calls, card decisions, route helpers |
| `lib/api/` | API request and response types, and the Zod schema for every request body |
| `lib/auth/` | Supabase Auth clients and the sign-in paths |
| `app/` | Routes. The product is under `app/app/`, served at `/app`. The API is under `app/api/` |
| `components/` | `ui/` primitives, `shell/` app chrome, and one folder per feature |
| `supabase/migrations/` | The database schema, one SQL file per change |
| `docs/security.md` | Each security control and the file that holds it |
| `docs/research/` | The team's research on the businesses Anchored serves |
| `docs/prototype/` | The single-page prototype the app was ported from |

## Invariants

Each rule protects an owner's customers or data, and breaking one can pass every test. Before you change code a rule names, read its section in [`docs/security.md`](docs/security.md).

- **The model writes text only.** Code decides every workflow, path, score and send, and validates each model reply before using it. `lib/server/ai.ts`, `intake-ai.ts` and `business-chat.ts` hold the model features.
- **`checkSend` gates every send.** `checkSend` in `lib/domain/executor.ts` enforces quiet hours, the allergy lock, the opt-out line, unfilled `[placeholders]` and consent. `decideCard` in `lib/server/decide.ts` runs it, and is the one code path that writes to the outbox.
- **Card decisions and rewrites go through `Store.updatePendingCard`.** It writes only while the card is still pending, so a double tap decides and sends once.
- **Every `Store` method filters by session.** Each one takes the session id and filters on it. Callers get the id from `getSessionId` in `lib/server/session.ts`, not from request input. `useAiCall`, the daily model call counter, is the one deployment-wide method. A new method lands in `lib/store/types.ts`, `memory.ts` and `supabase.ts` together, and `reset` clears any table it adds.
- **Every model call goes through `getBudgetedLlm`** in `lib/server/ai-budget.ts`, which counts it against `AI_DAILY_CALL_CAP`. `getLlm` from `lib/llm` has that one caller.
- **`lib/server` and `lib/llm` modules import `server-only`** on their first line, so a client component that imports one fails the build.
- **Migrations are append-only.** Name a new one `YYYYMMDDHHMMSS_name.sql`, with a timestamp after the newest file on `main`. Once merged, a migration is frozen; change the schema with a new file.
- **A new API mutation gets a rate limit bucket** in `middleware.ts`: an entry in `LIMITS` and a match in `limitFor`. Any unmatched route shares the general `mutation` bucket. The route reads its body through `readBody` in `lib/server/http.ts` with a schema from `lib/api/schemas.ts`.

## Working in parallel

Several agents work at once, each in its own git worktree on its own branch.

1. Agree with the lead on the files you own before you start. Edit only those. When your change needs a file someone else owns, ask the lead.
2. Run `git fetch origin`, then branch from `origin/main`. Name the branch `feat/`, `fix/`, `docs/`, `refactor/` or `ci/` plus a short slug, such as `fix/quiet-hours-dst`.
3. Run `npm ci`. A fresh worktree has no `node_modules`.
4. Check your work in a browser on a port of your own. Leave port 3000 to the lead's dev server.

   ```bash
   npm run build
   ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p 3101
   ```

   Pick a port no other agent is using.
5. Run `npm run check`, and push only once it passes.
6. Push your branch. Work reaches `main` only through a PR, merged with a merge commit, so each of your commits stays in `main`'s history.

## Conventions

- Commit messages follow Conventional Commits 1.0.0: `type(scope): description`, lowercase, present tense, no trailing period. `git log --oneline` shows the scopes in use.
- Commits and PRs carry no AI attribution, such as a `Co-Authored-By` trailer for a model or a "Generated with" footer.
- Code comments, docs, commits and UI copy separate clauses with a period or a comma. They contain no em dashes or en dashes.
- Quotes are straight. Headings are sentence case.
- Each file has a `Module Overview` banner below its imports: a short comment paragraph on what the file does. `lib/domain/executor.ts` shows the shape.
- Each exported function has a one-line `/** */` doc comment above it.
- Tests sit beside the code as `<name>.test.ts`.
