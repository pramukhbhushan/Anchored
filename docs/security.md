# Security controls

Anchored runs as a public demo with no login. This page lists each control that protects visitors' data, the paid model calls, and the customers who would receive a message. Each section names the file that holds the control and states its limits.

## Anonymous sessions

`middleware.ts` gives each visitor an `anchored_session` cookie on the first request that lacks one. The value is a random UUID from `crypto.randomUUID()`. The cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and expires after 30 days (`SESSION_MAX_AGE_SECONDS` in `lib/session-cookie.ts`). In production it is also `Secure`.

`getSessionId` in `lib/server/session.ts` reads the cookie. Every `Store` method takes the session id and filters on it, so a visitor sees only the businesses, choices, cards, outbox entries and events that their own session created. The three case studies live in code and are read-only. Choices and cards for a case study are stored per session.

The cookie value is the only credential. Anyone who holds a visitor's cookie value can read and change that visitor's data.

## Database access

`supabase/migrations/20261107000000_init.sql` turns on row-level security for all five tables (`businesses`, `workflow_choices`, `cards`, `outbox` and `events`) and adds no policies. The public anon key can read and write nothing.

`SupabaseStore` in `lib/store/supabase.ts` connects from the server with `SUPABASE_SERVICE_ROLE_KEY`. The service role bypasses row-level security, so the `session_id` filter in each query is what keeps one session's rows from another. No Supabase key reaches the browser.

With no Supabase variables set, `getStore` in `lib/store/index.ts` uses `MemoryStore` instead, which keeps data in process memory.

## Request validation

Each API route that takes a body parses it with a Zod schema from `lib/api/schemas.ts`, through `readBody` in `lib/server/http.ts`. A body that is not JSON, or does not match the schema, gets a 400 that names the first problem. The schemas cap every string and list. For example, an onboarding answer holds at most 1,500 characters and an edited card body at most 2,000. `POST /api/cards/[id]/rewrite` and `POST /api/reset` take no body.

Routes also check path parameters against data the session owns:

- A card or business id outside the session returns 404. The code-defined case studies are the one exception, open to every session.
- `PUT /api/businesses/[id]/choices` accepts only a path and a tool that `pathOptions` offers for that workflow.
- `POST /api/ingest/[source]` accepts only the sources in its `SOURCE_SKILL` map.

## Rate limits

`middleware.ts` rate-limits every `/api/*` request except GET and HEAD, keyed by client IP. The IP is the first `x-forwarded-for` entry, then `x-real-ip`, then the shared value `unknown`. Vercel sets `x-forwarded-for` itself, so a client on Vercel can't pick its own IP. `lib/server/rate-limit.ts` holds the fixed-window counter.

| Request | Limit per IP per 10 minutes | What the request does |
| --- | --- | --- |
| `POST /api/businesses` | 10 | Calls the paid model when onboarding answers are sent |
| `POST /api/cards/[id]/rewrite` | 20 | Calls the paid model |
| `POST /api/businesses/[id]/cards` and `POST /api/ingest/[source]` | 60, shared | Creates a card |
| Any other API request except GET and HEAD | 120 | Writes to the database |

A request over its limit gets a 429 with an `{ error }` body and a `Retry-After` header that holds the seconds until the window resets.

Each server instance keeps its own counts in memory. On Vercel, a client whose requests spread over several instances gets each limit once per instance, and a new instance starts from zero. A shared store such as Redis would make the limits global.

## Cross-site request check

For the same requests, `middleware.ts` compares the host in the `Origin` header with the request's `Host`. A different host, or an `Origin` of `null`, gets a 403. A request with no `Origin` passes. Browsers send `Origin` on a cross-site POST, and a client that is not a browser has no visitor's cookie to send.

The cookie's `SameSite=Lax` setting also stops browsers from sending it on a cross-site POST.

## Request body cap

`middleware.ts` refuses an API request other than GET or HEAD with a 413 when its `content-length` is over 64 KB. The check reads the declared length only. A chunked body without `content-length` reaches the route, where Vercel's 4.5 MB function body limit and the schema caps apply.

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
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

`script-src` and `style-src` allow `'unsafe-inline'` because Next.js renders inline hydration scripts and styles. `next/font/google` downloads the fonts at build time and serves them from the app, so `font-src 'self'` covers them. Development builds send no CSP and no HSTS, because the Next.js dev server runs code with `eval`.

## Data retention

`supabase/migrations/20261107000100_retention.sql` adds `purge_expired_demo_data()`. The function deletes rows older than 30 days from all five tables and returns the count deleted from each. Thirty days matches the session cookie's lifetime. The migration revokes `EXECUTE` on the function from `public`, `anon` and `authenticated`, so the public Supabase API can't call it.

The function runs only when something calls it. The end of the migration holds a commented-out `cron.schedule` call that runs it daily. That call works only after `pg_cron` is enabled in the Supabase project under **Database > Extensions**.

`MemoryStore` has no retention. Its data lasts until the server instance restarts.

## Secrets

Secrets come only from environment variables:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, read in `lib/store/index.ts`.
- The AI provider key that `lib/llm/config.ts` reads for the configured `AI_PROVIDER`, such as `ANTHROPIC_API_KEY`.

None of these names has the `NEXT_PUBLIC_` prefix, so Next.js never puts them in the browser bundle. `.gitignore` excludes `.env` and `.env*.local`, and `.env.example` lists the names with empty values. The `lib/server/` modules that read the session, the store or the model import `server-only`, so a client component that imports one fails the build.

## Model calls

`lib/server/ai.ts` makes the two model calls: `enrichProfile` during onboarding and `rewriteInVoice` on a card. The model rewrites text only. Code sets every workflow, path and score. Code also trims and caps each text field the model returns, and adds back the "Reply STOP to opt out." line when a rewrite drops it. If enrichment fails, onboarding keeps the profile that the rules built. The onboarding prompt wraps the owner's answers in `<owner_answers>` tags and tells the model to treat them as information, not instructions.

## Executor rules and the simulated outbox

`decideCard` in `lib/server/decide.ts` applies an owner's Approve or Skip:

- A card that is not pending gets a 409.
- A skipped card sends nothing.
- An approved locked card is marked approved and sends nothing, because the owner replies to that customer directly.
- Any other approved card goes through `checkSend` before `decideCard` writes to the outbox.

`checkSend` in `lib/domain/executor.ts` applies these rules in order:

1. A locked card is refused.
2. A list card passes. It changes only the owner's own lists.
3. A body that mentions allergies (any word that starts with `allerg`) is refused. Allergy answers must come from the owner.
4. An email passes.
5. A text with no consent on file is refused.
6. A text between 8 p.m. and 8 a.m. in the business's time zone is refused for quiet hours.

When `checkSend` refuses a card, `decideCard` looks for the first whole hour in the next 24 when the card would pass. A text held back only by quiet hours is approved and queued for that hour. A card that no hour fixes, such as an allergy answer, stays pending, and the response carries the reason for the owner. `decideCard` still saves any edit the owner made to it.

Two values are fixed for the demo. Every business uses the `America/New_York` time zone, and `decideCard` passes `hasConsent: true` because demo contacts are seeded with consent. The consent rule exists in `checkSend` but never refuses a card in this build.

An approved card writes a row to the `outbox` table, or to memory under `MemoryStore`. Nothing leaves the app. No SMS or email provider is connected, and no route sends a message to a real recipient.

## Known limits

- Rate limits apply per server instance, not across the deployment.
- The session cookie is the only credential, with no login behind it.
- Without Supabase variables, `MemoryStore` grows with every session and has no size limit, so a public deployment needs Supabase.
- `POST /api/ingest/[source]` trusts the session cookie. A real Twilio or form webhook must verify its signature instead.
- The CSP allows inline scripts, so it does not block an injected inline script. React escapes rendered text, and no component sets raw HTML.
- Retention runs only after someone schedules `purge_expired_demo_data()` with `pg_cron`.
- Requests with neither `x-forwarded-for` nor `x-real-ip` share the `unknown` rate-limit bucket.
