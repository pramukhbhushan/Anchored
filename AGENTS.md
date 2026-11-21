# Anchored agent guide

Anchored helps small business owners find, compare and adopt AI tools. Where no tool fits a job, an approve-first agent drafts the work as cards and sends nothing until the owner approves each one.

The users are small business owners, such as an HVAC contractor or a corner store owner, not engineers. Write every owner-facing string in plain words: say what happened, then what to do next. The refusals in `checkSend` (`lib/domain/executor.ts`) set the tone, for example "Quiet hours: texts wait until 8 a.m."

## Running it

Use Node.js 26, the version in `.nvmrc`. `npm run check` runs the type check, the tests and the build, the same steps as CI in `.github/workflows/ci.yml`. It needs no keys.

A fresh worktree has no `.env.local`, so it runs with accounts off, AI off and data in memory, and the rules draft every profile and card. A production build with no Supabase settings throws on its first data read; `ANCHORED_ALLOW_MEMORY_STORE=1` lets it run on the in-memory store. [`docs/deploy.md`](docs/deploy.md) explains every environment variable.

## Where code goes

Code sits in layers, and each layer imports only the layers below it: `lib/domain` at the bottom with `zod` alone, `components/` and `app/` on top. Routes and pages call `lib/server`, and only `lib/server` gets the store. [`lib/architecture.test.ts`](lib/architecture.test.ts) fails `npm test` on any import that breaks a rule.

Read [`docs/architecture.md`](docs/architecture.md) before you add a module or a cross-folder import, or a new workflow, skill, tool, provider, connector, page, route or migration. It holds the rule table, a map of `lib/domain`, and a "Where to add things" table.

## Invariants

Each rule protects an owner's customers or data, and breaking one can pass every other test. Before you change code a rule names, read its section in [`docs/architecture.md`](docs/architecture.md#the-invariants) or [`docs/security.md`](docs/security.md).

- **The model writes text only.** Code decides every workflow, path, score and send, and validates each model reply before using it. In the business chat, `readRequest` in `lib/domain/requests.ts` picks the skill, and the model writes only the draft's words.
- **`checkSend` gates every send.** `lib/server/decide.ts` is the one module that writes to the outbox, and `decideCard` there runs `checkSend` on every approved card.
- **Anchored sends only through `lib/server/dispatch.ts`.** It runs `checkSend` again at send time and texts only a number with a consent record and no STOP.
- **Card decisions and rewrites go through `Store.updatePendingCard`.** It writes only while the card is still pending, so a double tap decides and sends once.
- **Every `Store` method filters by session.** Callers get the session id from `getSessionId` in `lib/server/session.ts`, never from request input. A few methods work across the deployment on purpose; [`docs/architecture.md`](docs/architecture.md#the-invariants) lists them. A new method lands in `lib/store/types.ts`, `memory.ts` and `supabase.ts` together, and `reset`, which "Delete my businesses" runs, clears any table it adds.
- **Every model call runs on the business's own AI key, through `getBusinessLlm`** in `lib/server/business-llm.ts`. It returns the key the owner saved on Connections, or `null`, and the rules write. The deployment holds no AI key and the web app reads no AI setting from the environment, so onboarding, which runs before a business exists, always uses the rules. The one direct call is `checkOwnerKey`, which tests a key before it is saved and sits behind the `aiKey` rate limit. Only `business-llm.ts` calls `ownerLlm` from `lib/llm`; only `scripts/discover.ts`, an operator's command-line tool, calls `keyLlm` with a key from its own environment.
- **Server code imports `server-only`.** Each `lib/server`, `lib/llm` and `lib/connectors` module that reads a secret or calls the store or a provider starts with `import "server-only"`, so a client component that imports it fails the build. The modules `middleware.ts` shares import nothing at all; the layer test lists them.
- **Migrations are append-only.** Name a new one `YYYYMMDDHHMMSS_name.sql`, with a timestamp after the newest file on `main`. Once merged, a migration is frozen; change the schema with a new file.
- **Rate-limit each new API mutation in `middleware.ts`.** A route that calls a model or creates rows gets its own entry in `LIMITS` and a match in `limitFor`; any other falls into the shared `mutation` bucket. The route reads its body through `readBody` in `lib/server/http.ts` with a schema from `lib/api/schemas.ts`.

## UI rules

The owner wants every page to use the whole screen and adapt to it. `app/globals.css` holds the tokens.

- **Fill the width.** Give pages and sections no `max-width`; lay repeated items in grids with `repeat(auto-fill, minmax(min(100%, <n>px), 1fr))`, and switch layouts with `@container app` queries, since the sidebar changes the space. Cap only running text, at about `65ch`. Phones get one column with no sideways scroll.
- **Spacing and type come from tokens:** `--s-1` to `--s-8` (4 to 64px; 12px inside a card, 16 to 24px between cards, 48px between sections), `--pad` for card padding, and the seven `--fs-*` sizes.
- **Say each thing once per page.** One filled button per region, at most one badge per card, boxes only for things the owner decides (approval cards, the brief, the bill), and secondary detail behind a `<details>`. Carbon yellow marks only the brief, the owner's OK step on the Workflows graph, the active nav item and the approvals count. Owner-facing pages say who handles each job ("Your OpenTable sends reminders", "Anchored drafts it, you approve") and never use the internal path names Turn on, Buy, Build or Skip; those stay in `lib/domain` and on the marketing pages.

## Working in parallel

Other people and agents may work in this repo at the same time, each in its own git worktree on its own branch, and all of it lands on `main`.

1. If anyone else is working at the same time, agree with the person directing you on the files you own, and edit only those.
2. Run `git fetch origin`, then branch from `origin/main`. Name the branch `feat/`, `fix/`, `docs/`, `refactor/` or `ci/` plus a short slug, such as `fix/quiet-hours-dst`.
3. Run `npm ci`. A fresh worktree has no `node_modules`.
4. Check your work in a browser on a port of your own. Port 3000 may belong to someone else's `npm run dev`.

   ```bash
   npm run build
   ANCHORED_ALLOW_MEMORY_STORE=1 npx next start -p 3101
   ```

   Pick a port no other agent is using.
5. To push, open a PR or merge, follow [`.claude/skills/land-a-pr/SKILL.md`](.claude/skills/land-a-pr/SKILL.md) step by step. `main` has no branch protection, so `npm run check` on the merged tree is the only gate.

## Conventions

- Commit messages follow Conventional Commits 1.0.0: `type(scope): description`, lowercase, present tense, no trailing period. `git log --oneline` shows the scopes in use.
- Commits and PRs carry no AI attribution, such as a `Co-Authored-By` trailer for a model or a "Generated with" footer.
- Code comments, docs, commits and UI copy separate clauses with a period or a comma. They contain no em dashes or en dashes.
- Quotes are straight. Headings are sentence case.
- Each file has a `Module Overview` banner below its imports: a short comment paragraph on what the file does. `lib/domain/executor.ts` shows the shape.
- Each exported function has a one-line `/** */` doc comment above it.
- Tests sit beside the code: `<name>.test.ts` for logic, `<name>.test.tsx` for components. Component tests assert what an owner sees and does (roles, accessible names, links, the request sent), never class names, so a restyle keeps them green. Mock the network only at `fetch` with the helpers in `test/http.ts`; `test/setup-dom.ts` and `test/next.ts` cover the DOM setup and `next/navigation`.
- `lib/docs-links.test.ts` fails `npm test` when a doc links to a missing file or names a missing repo path in backticks.
