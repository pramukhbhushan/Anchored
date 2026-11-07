# Anchored

Anchored helps any small business discover, compare and adopt AI tools. An owner describes how the business runs. Anchored maps the work AI can take on into workflows, offers three paths for each one, and rates real tools against the software the owner already uses. Where no tool fits, an approve-first agent drafts the work and waits for the owner's tap.

Built for the University of Maryland AI for Small Business Hack-a-thon, Fall 2026. The research behind it sits in the repository root: HVAC, coaching, and corner stores and restaurants.

## How the product is organized

- **Workflows are the what.** Five are shared by every business: answer and return calls, bookkeeping and invoicing, lead follow-up, social posts, and quotes. Onboarding answers add others, such as a supplier price check, delivery disputes or a SNAP stocking check.
- **Each workflow has three paths.** Turn on a tool the owner already pays for, buy one from the catalog, or have Anchored build it.
- **Five agents run the build path.** Front Desk, Follow-up, Bookkeeping and Invoicing, Content and Social, and Internal Communications. Each agent runs skills, such as Closer or Price Watch. Internal Communications always runs the daily brief and forwarded-email triage.
- **Onboarding can spawn a niche agent** for work only some businesses have, such as SNAP Stock Check. A niche agent reuses the same actions and rules, and asks for approval on every card.
- **Tools are rated on seven checks**, personalized by onboarding: price and cancel terms, easy to start, connects to your software, states data use, you stay in charge, names your languages, and proven in similar businesses. Each check shows its evidence level. Code computes every score; the model never sets one.
- **Plain code sends.** The executor checks quiet hours, consent and the allergy lock before anything goes out. In this build, texts and emails go to a simulated outbox.

Trade templates are hints. Onboarding suggests answers that businesses like yours often give, and the owner confirms each one.

## Run it locally

You need Node.js 20 or later.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file. Every key is optional for a local run:

   ```bash
   cp .env.example .env.local
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000.

With no keys set, Anchored keeps data in memory and maps businesses with its own rules. Data resets when the server restarts.

## Environment variables

| Variable | What it turns on |
| --- | --- |
| `SUPABASE_URL` | Saved businesses, choices, cards and the outbox in Supabase Postgres |
| `SUPABASE_SERVICE_ROLE_KEY` | The server's key for Supabase. It never reaches the browser |
| `ANTHROPIC_API_KEY` | Claude rewrites onboarding text in the owner's words, and "Rewrite in my voice" on cards |

Claude runs each task on the model its tier names: Claude Haiku 5.5 for short rewrites, Claude Sonnet 5.5 for onboarding text. Change the mapping in `lib/server/claude.ts`.

## Set up Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/20261107000000_init.sql` in the project's SQL editor, or with the Supabase CLI:

   ```bash
   supabase db push
   ```

3. Copy the project URL and the service role key into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Row-level security is on for every table, with no policies. Only the server, holding the service role key, can read or write.

## Deploy to Vercel

1. Import the repository in Vercel. The default Next.js settings work.
2. Add the three environment variables under **Settings > Environment Variables**.
3. Deploy.

Every visitor gets an anonymous session cookie, so judges can test without logging in and see only their own businesses and cards. **Reset demo** clears a session.

## Project layout

| Path | Contents |
| --- | --- |
| `app/` | Pages and API routes |
| `lib/domain/` | Workflows, agents and skills, the catalog, ratings, the rules engine, case studies, card templates and the executor. Pure TypeScript with tests |
| `lib/server/` | Session, data access, Claude calls and card decisions |
| `lib/store/` | The `Store` interface with Supabase and in-memory versions |
| `supabase/migrations/` | Database schema |
| `docs/build-contract.md` | The exports each module provides |
| `mvp/anchored.html` | The single-page prototype this app was ported from |

## Test

```bash
npm test
```

```bash
npm run typecheck
```
