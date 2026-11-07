# Anchored

Anchored helps any small business discover, compare and adopt AI tools. An owner describes how the business runs. Anchored maps the work AI can take on into workflows, offers three paths for each one, and rates real tools against the software the owner already uses. Where no tool fits, an approve-first agent drafts the work and waits for the owner's tap.

Built for the University of Maryland AI for Small Business Hack-a-thon, Fall 2026. The research behind it is in `docs/research/`: HVAC, coaching, and corner stores and restaurants.

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

Every variable is optional for `npm run dev`. `.env.example` lists them all with empty values.

### Accounts and storage

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project URL. Together with `NEXT_PUBLIC_SUPABASE_ANON_KEY`, it turns on accounts: email magic links, Google, and **Continue as guest**. The store also uses it when `SUPABASE_URL` is unset |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The project's public anon key. The browser and `middleware.ts` use it to sign visitors in. Row-level security limits what it can reach |
| `SUPABASE_URL` | The project URL for the store. Optional when `NEXT_PUBLIC_SUPABASE_URL` names the same project |
| `SUPABASE_SERVICE_ROLE_KEY` | The server's key for the store, which saves businesses, choices, cards, and the outbox in Supabase Postgres. It never reaches the browser |
| `ANCHORED_ALLOW_MEMORY_STORE` | Set to `1` to let a production build run on the in-memory store, for example to test `next start` on your machine |

With the two `NEXT_PUBLIC_SUPABASE_*` variables unset, accounts are off. Each visitor gets an anonymous session cookie instead, and the app shows "Local demo".

Next.js copies every `NEXT_PUBLIC_` variable into the browser bundle when it builds. After you add or change one, rebuild the app, or redeploy it on Vercel.

A production build with no store settings throws on its first data read, so a public deploy can't lose visitors' work in memory without anyone noticing. `ANCHORED_ALLOW_MEMORY_STORE=1` turns that check off.

### AI provider

With no AI settings, Anchored maps businesses and drafts cards with its own rules. `lib/llm/config.ts` reads the variables below, `lib/llm/` holds one adapter per provider, and `lib/server/ai.ts` makes the model calls.

| Variable | What it does |
| --- | --- |
| `AI_PROVIDER` | One of `anthropic`, `openai`, `openrouter`, `featherless`, or `openai-compatible` |
| `AI_API_KEY` | The API key for the provider in `AI_PROVIDER`, whichever it is |
| `AI_BASE_URL` | The endpoint root, which is the part before `/chat/completions`, such as `https://api.featherless.ai/v1`. Optional for the named providers, which each have a default; required for `openai-compatible`. It must use https, except for a model on `localhost` |
| `AI_MODEL` | The model for every tier. Every provider except `anthropic` needs it, unless all three tier variables are set |
| `AI_MODEL_QUICK`, `AI_MODEL_DEFAULT`, `AI_MODEL_COMPLEX` | The model for one tier. Each one overrides `AI_MODEL` |
| `AI_DAILY_CALL_CAP` | Model calls allowed per UTC day across every visitor, counted in Supabase. Default 2000; `0` turns model calls off |
| `APP_URL` | This deployment's public URL. Anchored sends it as the `HTTP-Referer` header to providers that ask for attribution, such as OpenRouter |

Each model call names a tier: `quick` for "Rewrite in my voice" and chat turns, and `default` for onboarding text. With `anthropic` and no model variables, the `quick`, `default`, and `complex` tiers run `claude-haiku-5-5`, `claude-sonnet-5-5`, and `claude-opus-5-5`.

Past `AI_DAILY_CALL_CAP`, chats and onboarding fall back to the rules and rewrites return 429. Before a public deploy, also set a hard spend cap in your AI provider's billing settings, as the backstop.

## Set up Supabase

Accounts and saved data both need a Supabase project. Do these steps in the Supabase dashboard unless a step says otherwise.

1. Create a Supabase project.
2. Run every file in `supabase/migrations/`, in filename order. Use the project's SQL editor, or the Supabase CLI:

   ```bash
   supabase db push
   ```

3. Copy the project's keys into your environment. Newer projects call the anon key the publishable key and the service role key the secret key. Either form works.
   - From **Project Settings > Data API**, copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
   - From **Project Settings > API Keys**, copy the anon key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the service role key into `SUPABASE_SERVICE_ROLE_KEY`.
4. Under **Authentication > Sign In / Providers**, turn on the three sign-in methods:
   - Leave **Email** on. Magic links use it.
   - Turn on **Allow anonymous sign-ins**. **Continue as guest** uses it.
   - Turn on **Google**, then paste the client ID and client secret of a Google OAuth client of type **Web application**. In Google Cloud, add `https://<project-ref>.supabase.co/auth/v1/callback` to that client's authorized redirect URIs.
5. Under **Authentication > URL Configuration**, set where Supabase may send visitors back:
   - Set **Site URL** to the production address, such as `https://anchored.vercel.app`.
   - Add `http://localhost:3000/**` and `https://<your-domain>/**` to **Redirect URLs**. To sign in on Vercel preview deploys, also add `https://*-<your-team>.vercel.app/**`.
6. Before a judged demo, set up your own SMTP server under **Authentication > Emails**. The built-in email service sends only a few emails an hour and is meant for testing.
7. If judges will share one network, raise **Anonymous sign-ins** under **Authentication > Rate Limits**. Supabase counts that limit per IP address.

A magic link works only in the browser that asked for it. That browser holds the one-time verifier that `/auth/callback` needs to finish the sign-in.

A guest who adds an email under **Save your work** keeps the same user id. Their businesses, choices, and cards carry over once they confirm the address.

The server reads and writes with the service role key, which bypasses row-level security. `20261107000200_auth_policies.sql` adds policies as a second layer. With them, a signed-in user's own token can reach only the rows whose `session_id` is that user's id. The anon key alone reaches nothing.

`purge_expired_demo_data()` deletes demo rows older than 30 days once you schedule it with `pg_cron`. It skips rows that belong to email and Google accounts, and deletes guests' rows.

## Deploy to Vercel

1. Set up Supabase as described above, with every migration run.
2. Import the repository in Vercel. The default Next.js settings work.
3. Under **Settings > Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. For AI, add `AI_PROVIDER`, its key, `AI_DAILY_CALL_CAP` and `APP_URL`.
4. Deploy, then add the deployment's address to Supabase's **Site URL** and **Redirect URLs**.

Judges can test without an account through **Continue as guest**, and each one sees only their own businesses and cards. **Reset demo** clears a session.

## Project layout

| Path | Contents |
| --- | --- |
| `app/` | Pages and API routes |
| `lib/domain/` | Workflows, agents and skills, the catalog, ratings, the rules engine, case studies, card templates and the executor. Pure TypeScript with tests |
| `lib/server/` | Session, data access, Claude calls and card decisions |
| `lib/store/` | The `Store` interface with Supabase and in-memory versions |
| `supabase/migrations/` | Database schema |
| `docs/architecture.md` | How the layers fit together |
| `docs/research/` | The research by trade, the design document, and where they disagree. Its `README.md` lists every file |
| `docs/prototype/` | The single-page prototype this app was ported from |

## Test

```bash
npm test
```

```bash
npm run typecheck
```
