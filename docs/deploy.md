# Deploy Anchored

These guides turn on the parts of Anchored that a local run leaves off: sign-in, saved data, AI, and real texts and email. Each section is one task, and each task works without the others. [Environment variables](#environment-variables) at the end lists every setting.

With no settings, Anchored runs on an in-memory store with accounts and AI off, and its own rules draft every profile and card. The README's quick start covers that mode.

## Run with accounts on your machine

Sign-in and saved data need Supabase. To run Supabase locally, you need Docker running and the Supabase CLI (`brew install supabase/tap/supabase`).

1. Start Supabase:

   ```bash
   supabase start
   ```

   The CLI applies every migration in `supabase/migrations/` and serves an email inbox for sign-in links at http://127.0.0.1:54324. `supabase/config.toml` already allows `http://localhost:3000` as a redirect and turns on guest sign-in.
2. Copy the values the CLI prints into `.env.local`:
   - `API URL` into `NEXT_PUBLIC_SUPABASE_URL`.
   - The anon or publishable key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - The service role or secret key into `SUPABASE_SERVICE_ROLE_KEY`.
3. Restart `npm run dev`.
4. Sign in with your email, then open the link that lands in the local inbox, in the same browser.

To stop Supabase, run `supabase stop`.

## Set up a Supabase project

Do these steps in the Supabase dashboard unless a step says otherwise.

1. Create a Supabase project.
2. Run every file in `supabase/migrations/` in filename order, oldest first. Use the **SQL Editor**, or `supabase db push` from the Supabase CLI on a new database.
3. Copy the project's keys into your environment. Newer projects call the anon key the publishable key and the service role key the secret key. Either form works.
   - From **Project Settings > Data API**, copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
   - From **Project Settings > API Keys**, copy the anon key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the service role key into `SUPABASE_SERVICE_ROLE_KEY`.
4. Under **Authentication > Sign In / Providers**, turn on the three sign-in methods:
   - Leave **Email** on. Magic links use it.
   - Turn on **Allow anonymous sign-ins**. **Continue as guest** uses it.
   - Turn on **Google**, then paste the client ID and client secret of a Google OAuth client of type **Web application**. In Google Cloud, add `https://<project-ref>.supabase.co/auth/v1/callback` to that client's authorized redirect URIs.
5. Under **Authentication > URL Configuration**, set where Supabase may send visitors back:
   - Set **Site URL** to your production address, such as `https://your-app.vercel.app`.
   - Add `http://localhost:3000/**` and `https://<your-domain>/**` to **Redirect URLs**. To sign in on Vercel preview deploys, also add `https://*-<your-team>.vercel.app/**`.
6. Under **Project Settings > JWT Keys**, check that the project signs with an asymmetric key, ECC or RSA, rather than the legacy shared secret. `middleware.ts` then checks each request's token itself. With the shared secret, it asks Supabase Auth on every request, link prefetches included.
7. Before launch, set up your own SMTP server under **Authentication > Emails**. The built-in email service sends only a few emails an hour and is meant for testing.
8. If many guests will sign in from one network, raise **Anonymous sign-ins** under **Authentication > Rate Limits**. Supabase counts that limit per IP address.
9. To delete old guest data, turn on the `pg_cron` extension under **Database > Extensions**, then schedule `purge_expired_demo_data()` once a day in the **SQL Editor**. `supabase/migrations/20261107000100_retention.sql` has the `cron.schedule` call in a comment. The function deletes guests' and anonymous sessions' rows older than 30 days, and keeps rows that belong to email and Google accounts.

A few behaviors follow from this setup:

- A magic link works only in the browser that asked for it. That browser holds the one-time verifier that `/auth/callback` needs to finish the sign-in.
- A guest who adds an email under **Save your work** keeps the same user id. Their businesses, choices and cards carry over once they confirm the address.
- The server reads and writes with the service role key, which bypasses row-level security. `supabase/migrations/20261107000200_auth_policies.sql` adds policies as a second layer: a signed-in user's own token reaches only the rows whose `session_id` is that user's id, and the anon key alone reaches nothing.

## Deploy to Vercel

`next build` needs no secrets, so a missing key never fails the build. A production server with no store settings throws on its first data read instead of keeping visitors' work in memory.

1. [Set up a Supabase project](#set-up-a-supabase-project).
2. Import the repository in Vercel. The default Next.js settings work.
3. Under **Settings > Functions**, set **Function Region** to the region closest to your Supabase project. A click waits on one or two Supabase round trips, and a full page load waits on three.
4. Under **Settings > Environment Variables**, add these for the Production environment:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | The project URL, from **Project Settings > Data API** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon or publishable key, from **Project Settings > API Keys** |
   | `SUPABASE_SERVICE_ROLE_KEY` | The service role or secret key, from the same page |

   Leave `ANCHORED_ALLOW_MEMORY_STORE` unset in production.
5. Deploy. Next.js copies every `NEXT_PUBLIC_` value into the browser bundle at build time, so redeploy after you change one.
6. Open your domain, sign in, set up a business, sign out, and sign back in. The business is still there if the store works.

`vercel.json` deploys only the `main` branch. To deploy from other branches, change `git.deploymentEnabled` in that file.

To turn on AI for every business, follow [Turn on AI](#turn-on-ai). To send and receive through real services, follow [Connect real services](#connect-real-services).

## Turn on AI

Without AI, Anchored's rules write every profile and card. With AI, a model writes the words, and code still decides every workflow, score and send.

Anchored can get a model key in two ways:

- **Each owner adds their own key.** On a business's **Connections** page, an owner signed in with email or Google picks Anthropic, OpenAI, OpenRouter or Featherless and pastes a key. That business's model calls run on the owner's key and bill the owner's account. The deployment needs `CONNECTOR_SECRET_KEY` set, which encrypts the key.
- **You set one key for everyone.** If you host Anchored for yourself, set `AI_PROVIDER` and `AI_API_KEY`, plus `AI_MODEL` for every provider except `anthropic`. Every business without its own key uses this one.

An owner's key wins over the environment key. To pay for no model calls on a public deployment, leave `AI_PROVIDER` and `AI_API_KEY` unset.

To set one key for everyone:

1. Set `AI_PROVIDER` to `anthropic`, `openai`, `openrouter`, `featherless` or `openai-compatible`.
2. Set `AI_API_KEY` to that provider's key.
3. For every provider except `anthropic`, set `AI_MODEL`. To use a different model for one tier, set `AI_MODEL_QUICK`, `AI_MODEL_DEFAULT` or `AI_MODEL_COMPLEX`.
4. For `openai-compatible`, set `AI_BASE_URL` to the endpoint root, the part before `/chat/completions`. It must use https, except for a model on `localhost`.
5. Set `AI_DAILY_CALL_CAP` to the number of calls the environment key may make each UTC day. The default is 2000, and `0` turns those calls off.
6. In your AI provider's billing settings, set a hard spend cap as a backstop.

Past the daily cap, chats and onboarding fall back to the rules, and **Rewrite in my voice** answers 429 until the next UTC day. The cap counts only calls on the environment key. Calls on an owner's key spend the owner's money.

With `anthropic` and no model variables, the `quick`, `default` and `complex` tiers run `claude-haiku-5-5`, `claude-sonnet-5-5` and `claude-opus-5-5`. On `featherless`, `AI_MODEL=Qwen/Qwen3.6-35B-A3B` answered a chat turn in 1.4 to 2.8 seconds in November 2026 tests. Anchored turns off thinking on every Featherless request, since Qwen otherwise spends its whole token budget thinking and returns no text.

## Connect real services

An owner connects Twilio and Stripe with their own accounts on a business's **Connections** page, signed in with email or Google. Resend, Postmark and Google Sheets run on accounts the deployment holds. Each service stays off until its variables are set, and Anchored never sends without the owner's approval.

Before you connect any service, set these on the server:

- `CONNECTOR_SECRET_KEY` to 32 random bytes in base64, from `openssl rand -base64 32`. It encrypts every credential an owner connects. If you change it, stored credentials become unreadable, and owners must connect again.
- `PUBLIC_APP_URL` to the deployment's public https address. The webhook URLs on the Connections page start with it.

To let a guest connect services in a local run, set `ANCHORED_ALLOW_GUEST_CONNECTIONS=1`. Leave it unset in production.

### Texts and missed calls with Twilio

Each business uses its own Twilio account, so the deployment needs no Twilio variables.

1. Buy a Twilio number and register it for A2P 10DLC texting. Twilio delivers no texts to US numbers until the registration clears, which can take days. Calls work before that.
2. On the Connections page, enter the Account SID, the auth token and the number.
3. In Twilio, paste the two webhook URLs from the Connections page into the number's **Messaging** and **Voice** settings.
4. Forward the shop's own line to the Twilio number when nobody answers. On Verizon, dial `*71` and the number. Many GSM carriers use `**61*<number>#`.

### Email out with Resend

1. Verify a sending domain in Resend.
2. Set `RESEND_API_KEY` to a Resend API key.
3. Set `EMAIL_FROM_ADDRESS` to an address on the verified domain. Each email shows the business's name and sets the owner as reply-to.

### Email in with Postmark

1. Create a Postmark inbound server.
2. Set `INBOUND_EMAIL_ADDRESS` to its inbound address. Each business forwards to that address with its own hook id after a `+`.
3. Set `INBOUND_EMAIL_SECRET` to a random string.
4. Set the server's inbound webhook to `<PUBLIC_APP_URL>/api/hooks/email?key=<INBOUND_EMAIL_SECRET>`.

### Invoices with Stripe

1. In the owner's Stripe account, add the webhook endpoint from the Connections page, for the `invoice.overdue` and `invoice.payment_failed` events.
2. Paste the endpoint's signing secret on the Connections page.

### Invoice sheets with Google Sheets

Bookkeeping reads an owner's invoice sheet as a Google service account that the owner shares the sheet with.

1. In Google Cloud, turn on the Google Sheets API.
2. Create a service account with no project role, and add a JSON key to it.
3. Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the key, on one line in single quotes.

The owner shares the sheet with the service account's email as a Viewer, then sends the sheet link in the business chat. Anchored only reads the sheet.

### Business lookup with Google Places

`GOOGLE_PLACES_API_KEY` turns on the **Is this you?** step in onboarding. After the owner types a name and town, Anchored shows up to three Google listings, and the one the owner picks fills in their hours and review link for them to confirm. In Google Cloud, restrict the key to the Places API and give it a daily quota.

## Schedule the background routes

Two routes do work that no click starts. Without a schedule, texts held for quiet hours never send, and no morning brief appears.

| Route | Call it | What it does |
| --- | --- | --- |
| `GET /api/cron/dispatch` | Every 5 minutes | Drafts recorded work that is due, such as a follow-up or a license reminder, then sends every queued message that is due |
| `GET /api/cron/brief` | Every hour | Writes each business's morning brief once a day, from 7 a.m. Eastern |

1. Set `CRON_SECRET` to a random string.
2. Call each route with the header `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends that header when the project has `CRON_SECRET` set, and an outside scheduler can send it too. `vercel.json` defines no cron jobs, so add them there or in your scheduler.

Both routes answer 404 when `CRON_SECRET` is unset or the header does not match.

## Set up Telegram

Telegram is optional and not verified in production. One shared bot serves every business: each business gets its own link, and a customer who opens it messages that business. The bot stays off unless `TELEGRAM_BOT_TOKEN` is set.

A bot sends updates to one address at a time. If you point it at a laptop tunnel, production stops getting its updates until you point it back.

1. In Telegram, open the official BotFather chat and create a bot with `/newbot`. Keep its token private.
2. Set these on the server and in the `.env.local` you register from:
   - `TELEGRAM_BOT_TOKEN` to the token.
   - `TELEGRAM_BOT_USERNAME` to the bot's username, without the `@`. Use the username, not the display name.
   - `TELEGRAM_WEBHOOK_SECRET` to a random string. The value must match on both sides, or the server rejects every update with 404.
3. [Schedule the background routes](#schedule-the-background-routes).
4. Point the bot at your deployment, then check where it points:

   ```bash
   node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts set https://YOUR-DEPLOYMENT
   node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/telegram-webhook.ts info
   ```

   `set` replaces the bot's webhook and drops pending updates. `info` prints the target, the number of waiting updates and Telegram's last error, without the token or the secret. A past error stays in that report, so send a new message to confirm that it arrives.
5. Create a business, choose a Customer workflow for Anchored to draft, and open **Connections** or **Customer**. Scan the QR code, tap **Start**, send a question, and review the draft in **Approvals**.

Only a reply the owner approves sends. The bot also sends a fixed acknowledgment when a customer writes, which the owner can turn off on the Customer workflow page or on **Approvals**. `/stop` stops that business's messages, and a new `/start` from its link restarts them. [The agent test runbook](testing/agent-demo.md) lists the checks to run on a real phone.

## Environment variables

Every variable is optional for a local run. `.env.example` lists them all.

### Accounts and storage

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project URL. With `NEXT_PUBLIC_SUPABASE_ANON_KEY`, it turns on accounts: email magic links, Google, and **Continue as guest**. The store also uses it when `SUPABASE_URL` is unset |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The project's public anon key. The browser and `middleware.ts` use it to sign visitors in. Row-level security limits what it can reach |
| `SUPABASE_URL` | The project URL for the store. Optional when `NEXT_PUBLIC_SUPABASE_URL` names the same project |
| `SUPABASE_SERVICE_ROLE_KEY` | The server's key for the store. It never reaches the browser |
| `ANCHORED_ALLOW_MEMORY_STORE` | Set to `1` to let a production build run on the in-memory store, for example to test `next start` on your machine |

With the two `NEXT_PUBLIC_SUPABASE_*` variables unset, accounts are off. Each visitor gets an anonymous session cookie instead, and the account menu says "This browser".

### AI

| Variable | What it does |
| --- | --- |
| `AI_PROVIDER` | One of `anthropic`, `openai`, `openrouter`, `featherless` or `openai-compatible` |
| `AI_API_KEY` | The API key for the provider in `AI_PROVIDER` |
| `AI_BASE_URL` | The endpoint root, before `/chat/completions`. Optional for the named providers, which each have a default. Required for `openai-compatible`. Must use https, except for a model on `localhost` |
| `AI_MODEL` | The model for every tier. Every provider except `anthropic` needs it, unless all three tier variables are set |
| `AI_MODEL_QUICK`, `AI_MODEL_DEFAULT`, `AI_MODEL_COMPLEX` | The model for one tier. Each one overrides `AI_MODEL` |
| `AI_DAILY_CALL_CAP` | Calls the environment key may make per UTC day, counted in the store. Default 2000. `0` turns those calls off |
| `APP_URL` | This deployment's public URL. Anchored sends it as the `HTTP-Referer` header to providers that ask for attribution, such as OpenRouter |

### Connected services

| Variable | What it does |
| --- | --- |
| `CONNECTOR_SECRET_KEY` | 32 random bytes in base64 that encrypt every credential an owner connects. Without it, no service that needs a secret can be connected |
| `PUBLIC_APP_URL` | This deployment's public https address. Webhook URLs start with it |
| `ANCHORED_ALLOW_GUEST_CONNECTIONS` | Set to `1` to let a guest connect services in a local run |
| `RESEND_API_KEY` | The Resend API key that sends approved emails |
| `EMAIL_FROM_ADDRESS` | The address approved emails come from, on a domain verified in Resend |
| `INBOUND_EMAIL_ADDRESS` | The Postmark inbound address |
| `INBOUND_EMAIL_SECRET` | The secret that Postmark's webhook URL carries as `?key=` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The JSON key of the Google service account that reads invoice sheets |
| `GOOGLE_PLACES_API_KEY` | Turns on the **Is this you?** step in onboarding |
| `CRON_SECRET` | The bearer token the scheduled routes require |
| `TELEGRAM_BOT_TOKEN` | The shared bot's token from BotFather. Server only |
| `TELEGRAM_BOT_USERNAME` | The bot's username, without the `@` |
| `TELEGRAM_WEBHOOK_SECRET` | The secret Telegram sends with each update. The registration script and the deployed app must use the same value |
