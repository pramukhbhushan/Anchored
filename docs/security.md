# Security controls

This page lists each control that protects visitors' data, the paid model calls, and the customers who would receive a message. Each section names the file that holds the control and states its limits.

## Sessions and accounts

`getSessionId` in `lib/server/session.ts` returns the id that every `Store` method filters on. Its source depends on whether accounts are on.

With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, accounts are on. The id is the Supabase Auth user id, for email-link, Google and guest users alike. `getSessionId` gets it from `supabase.auth.getClaims()`, which checks the session token's signature and expiry against the project's published signing keys instead of trusting the cookie. A project on the legacy shared secret has no published key, so `getClaims` asks Supabase Auth instead. Because the token is checked locally, a copy of it taken before sign-out keeps working until it expires, one hour by default. `findViewer`, which the layouts and the account menu read, asks Supabase Auth with `supabase.auth.getUser()`, so a guest who confirms an email shows as signed in with it on the next page load. `middleware.ts` refreshes the session on each request and redirects a visitor with no session from `/app` and every page under it to `/login?next=<path>`. An API route reached with no session returns 401. "Sign out" in the account menu posts to `/auth/signout`, which takes POST only, checks `Origin`, ends this browser's Supabase session with `signOut({ scope: "local" })` and redirects to `/`.

With those variables unset, accounts are off, as in local development and CI. `middleware.ts` gives each visitor an `anchored_session` cookie holding a random UUID from `crypto.randomUUID()`, and mints a new one when the value is missing or not a UUID. The cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and expires after 30 days (`SESSION_MAX_AGE_SECONDS` in `lib/session-cookie.ts`). In production it is also `Secure`. The cookie value is the only credential, so anyone who holds it can read and change that visitor's data.

Either way, a visitor sees only the businesses, choices, cards, outbox entries, chats and events that their own session created. The example business, Linden Street Kitchen, lives in code and is read-only. Choices and cards for the example are stored per session. `DELETE /api/businesses`, behind "Delete my businesses" in the account menu, runs `Store.reset` and deletes every row the session created.

## Database access

Every table has row-level security on: `businesses`, `workflow_choices`, `cards`, `outbox`, `events`, `intake_drafts`, `chat_messages` and `ai_usage`. The anon key alone reaches no row.

`SupabaseStore` in `lib/store/supabase.ts` connects from the server with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses row-level security. The `session_id` filter in each query is what keeps one session's rows from another. As a second layer, `20261107000200_auth_policies.sql` and `20261107000500_ai_budget_and_chat_policies.sql` let a signed-in user's own token reach only rows whose `session_id` is that user's id. `ai_usage` has no policy, so only the service role reads it.

With no store variables, `getStore` in `lib/store/index.ts` uses `MemoryStore`, which keeps data in process memory and holds at most 2,000 sessions, dropping the oldest. A production build throws on its first data read instead, unless `ANCHORED_ALLOW_MEMORY_STORE=1`, so a public deploy can't lose visitors' work in memory unnoticed.

## Request validation

Each API route that takes a body reads it through `readBody` in `lib/server/http.ts`:

- A body over 64 KB returns 413. The reader counts bytes as they stream, so a chunked body with no `content-length` is capped too.
- A request without `Content-Type: application/json` returns 415.
- A body that does not match its Zod schema from `lib/api/schemas.ts` returns 400 naming the first problem. The schemas cap every string and list. For example, an onboarding answer holds at most 1,500 characters and an edited card body at most 2,000.

Routes also check path parameters against data the session owns:

- A card or business id outside the session returns 404. The code-defined example business is the one exception, open to every session.
- `POST /api/businesses/[id]/cards`, "Watch an agent draft", runs only on the example business and returns 409 for an owner's own.
- `PUT /api/businesses/[id]/choices` accepts only a path and a tool that `pathOptions` offers for that workflow.
- `PUT /api/businesses/[id]/plan` saves a plan approval only on the session's own business, and returns 409 for the example, whose approval lives in code.
- `POST /api/ingest/[source]` accepts only the sources in its `SOURCE_SKILLS` map, each with its own payload schema.

## Rate limits

`middleware.ts` rate-limits every `/api/*` request except GET and HEAD. Each request counts against its session and its IP, and either limit refuses it. The IP is `x-real-ip`, then the first `x-forwarded-for` entry, then the shared value `unknown`. Vercel sets `x-real-ip` to the connecting address, so a client can't pick its bucket. `clientKey` counts an IPv6 address by its /64 prefix, since one subscriber usually holds a whole /64. `lib/server/rate-limit.ts` holds the fixed-window counter.

| Request | Per session | Per IP | What the request does |
| --- | --- | --- | --- |
| `POST /api/businesses` | 10 | 60 | Builds a profile, with a model call when AI is on |
| `POST /api/cards/[id]/rewrite` | 20 | 120 | Calls the model |
| `POST /api/intake`, `POST /api/intake/[id]` and `POST /api/businesses/[id]/chat` | 40, shared | 200, shared | Takes a chat turn, with a model call when AI is on |
| `POST /api/businesses/[id]/cards` and `POST /api/ingest/[source]` | 60, shared | 300, shared | Creates a card |
| Any other API request except GET and HEAD | 120 | 600 | Writes to the database |

All limits use a 10-minute window. Per-IP limits are five to six times looser than per-session ones, because people on one office or venue network share an address. A request over a limit gets a 429 with an `{ error }` body and a `Retry-After` header holding the seconds until the window resets.

Each server instance keeps its own counts in memory. On Vercel, a client whose requests spread over several instances gets each limit once per instance.

## AI call budget

`getBudgetedLlm` in `lib/server/ai-budget.ts` wraps the configured provider. Before each model call it runs `use_ai_call`, a SQL function from `20261107000500_ai_budget_and_chat_policies.sql` that adds one to today's row in `ai_usage` and reports whether the count is still under `AI_DAILY_CALL_CAP` (default 2,000, and 0 turns model calls off). The increment and the comparison are one statement, so concurrent calls can't overshoot, and every server instance shares the count. The day is UTC.

Past the cap, onboarding, the intake chat and the business chat fall back to the rules, and a rewrite returns 429. The provider's own spend cap stays the backstop.

## Discovery agent

`npm run discover` is the only caller of `fetchPage` in `lib/server/fetch-page.ts`, and no route reaches it, so a visitor can't make the server load an address. `fetchPage` still loads only public http and https addresses on the default port. It refuses localhost, private and link-local IP ranges, IPv6 literals and single-label hosts, checks the address again after redirects, and drops replies that aren't HTML, are over 2 MB or take over 10 seconds. Page text is untrusted: the prompts mark it as data, and `vetCandidates` in `lib/domain/discovery.ts` keeps a tool only when its source is a page the run loaded and that page names it. Nothing the agent finds gets a score or reaches an owner's page until a person reviews the change to `lib/domain/discovered.json`.

## Cross-site request check

For the same requests, `middleware.ts` compares the host in the `Origin` header with the request's `Host`. The check is `isAllowedOrigin` in `lib/server/origin.ts`, which the sign-out route in `app/auth/signout/route.ts` also runs. A different host, or an `Origin` of `null`, gets a 403. A request with no `Origin` passes. Browsers send `Origin` on a cross-site POST, and a client that is not a browser has no visitor's cookie to send. The cookies' `SameSite=Lax` setting also stops browsers from sending them on a cross-site POST.

## Security headers

`next.config.ts` adds these headers to every response.

| Header | Value | Sent in |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | All builds |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | All builds |
| `X-Frame-Options` | `DENY` | All builds |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | All builds |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Production |
| `Content-Security-Policy` | The policy below | Production |

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <supabase origin>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

`connect-src` adds the origin of `NEXT_PUBLIC_SUPABASE_URL` when accounts are on, because the browser calls Supabase Auth directly for sign-in. `script-src` and `style-src` allow `'unsafe-inline'` because Next.js renders inline hydration scripts and styles. `next/font/google` downloads the fonts at build time and serves them from the app, so `font-src 'self'` covers them. Development builds send no CSP and no HSTS, because the Next.js dev server runs code with `eval`. `poweredByHeader: false` drops the `X-Powered-By` header.

## Data retention

`purge_expired_demo_data()` deletes rows older than 30 days and returns the count deleted from each table. Thirty days matches the session cookie's lifetime. The latest version, in `20261107000500_ai_budget_and_chat_policies.sql`:

- covers the five original tables and both chat tables;
- skips rows whose `session_id` belongs to a non-anonymous user in `auth.users`, so a real account's data stays until its owner deletes it;
- deletes `ai_usage` rows older than 7 days.

The migrations revoke `EXECUTE` on the function from `public`, `anon` and `authenticated`, so the public Supabase API can't call it. The function runs only when something calls it. `20261107000100_retention.sql` ends with a commented-out `cron.schedule` call that runs it daily, which works once `pg_cron` is enabled under **Database > Extensions**.

`MemoryStore` has no retention. Its data lasts until the server instance restarts.

## Secrets

Secrets come only from environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`, read in `lib/store/index.ts`.
- `AI_API_KEY`, the key for the configured `AI_PROVIDER`, read in `lib/llm/config.ts`.

Neither name has the `NEXT_PUBLIC_` prefix, so Next.js never puts them in the browser bundle. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design, and row-level security limits what it reaches. `.gitignore` excludes `.env` and `.env*.local`, and `.env.example` lists the names with empty values. Each module in `lib/server/` and `lib/llm/` that reads a secret or calls the store or a model provider imports `server-only`, so a client component that imports one fails the build. The helpers that the edge middleware shares with the server and the browser import nothing, `server-only` included: `lib/server/origin.ts`, `lib/server/rate-limit.ts`, `lib/session-cookie.ts`, and `config.ts`, `paths.ts`, `session-id.ts` and `viewer.ts` in `lib/auth/`. `lib/architecture.test.ts` enforces that list, and also fails any `"use client"` file that imports `lib/server`, `lib/store`, `lib/llm` or `server-only`.

## Model calls

The model writes text only. Code sets every workflow, path, score and send decision, and checks every reply:

- `enrichProfile` in `lib/server/ai.ts` rewrites a rules-built profile's text during onboarding. Code trims and caps each field, and a failure keeps the rules-built profile. The prompt wraps the owner's answers in `<owner_answers>` tags and tells the model to treat them as information, not instructions.
- `rewriteInVoice` redrafts a card. `newFacts` throws away a rewrite that adds a URL, email address, phone number, dollar amount or other number the draft did not have, and the route returns 422. Code adds back the "Reply STOP to opt out." line if the rewrite dropped it. The rewrite is saved only if the card is still pending when the model answers.
- `lib/server/intake-ai.ts` and `lib/server/business-chat.ts` read chat answers into profile changes. Code validates each change against the allowed lists, and any model failure falls back to the rules for that turn.

## Executor rules and the simulated outbox

`decideCard` in `lib/server/decide.ts` applies an owner's Approve or Skip:

- Every status change goes through `Store.updatePendingCard`, which writes only while the card is still pending. When two requests decide the same card at once, one wins and the other gets a 409, so a double tap sends one message. The unique index on `outbox(card_id)` backs this in Postgres.
- A skipped card sends nothing.
- An approved locked card is marked approved and sends nothing, because the owner replies to that customer directly.
- For a text, `decideCard` puts back the opt-out line if the owner's edit removed it.
- Any other approved card goes through `checkSend` before `decideCard` writes to the outbox.

`checkSend` in `lib/domain/executor.ts` applies these rules in order:

1. A locked card is refused.
2. A list card passes. It changes only the owner's own lists.
3. A body that mentions an allergen is refused. `mentionsAllergen` matches allergy words and common allergens in English, Spanish, Korean and Chinese, after folding case and dropping accents and zero-width characters. Allergy answers must come from the owner.
4. A body that still holds a placeholder such as `[time]` is refused.
5. An email passes.
6. A text that does not end with "Reply STOP to opt out." is refused.
7. A text with no consent on file is refused.
8. A text between 8 p.m. and 8 a.m. in the business's time zone is refused for quiet hours.

When `checkSend` refuses a card, `decideCard` looks for the first whole hour in the next 24 when the card would pass. A text held back only by quiet hours is approved and queued for that hour. A card that no hour fixes, such as an allergy answer, stays pending, and the response carries the reason for the owner. `decideCard` still saves any edit the owner made to it.

Two values are fixed in this build. Every business uses `OWNER_TIME_ZONE`, `America/New_York`, and `decideCard` passes `hasConsent: true` because drafted contacts come with consent. The consent rule exists in `checkSend` but never refuses a card in this build.

An approved card writes a row to the `outbox` table, or to memory under `MemoryStore`, where it waits until texting and email are connected. Nothing leaves the app. No SMS or email provider is connected, and no route sends a message to a real recipient.

## Known limits

- Rate limits apply per server instance, not across the deployment. The AI call budget is the one deployment-wide limit.
- With accounts off, the session cookie is the only credential.
- `POST /api/ingest/[source]` trusts the session. A real Twilio or form webhook must verify its signature, check a suppression list and run sends from a scheduler instead.
- Consent is fixed to `true`, so a real deployment needs consent records per contact before it sends texts.
- The CSP allows inline scripts, so it does not block an injected inline script. React escapes rendered text, and no component sets raw HTML.
- Retention runs only after someone schedules `purge_expired_demo_data()` with `pg_cron`.
- Requests with neither `x-real-ip` nor `x-forwarded-for` share the `unknown` rate-limit bucket.
