# Security controls

This page lists each control that protects visitors' data, the paid model calls, and the customers who would receive a message. Each section names the file that holds the control and states its limits.

## Sessions and accounts

`getSessionId` in `lib/server/session.ts` returns the id that every `Store` method filters on. Its source depends on whether accounts are on.

With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, accounts are on. The id is the Supabase Auth user id, for email-link, Google and guest users alike. `getSessionId` gets it from `supabase.auth.getClaims()`, which checks the session token's signature and expiry against the project's published signing keys instead of trusting the cookie. A project on the legacy shared secret has no published key, so `getClaims` asks Supabase Auth instead. Because the token is checked locally, a copy of it taken before sign-out keeps working until it expires, one hour by default. `findViewer`, which the layouts and the account menu read, asks Supabase Auth with `supabase.auth.getUser()`, so a guest who confirms an email shows as signed in with it on the next page load. `middleware.ts` refreshes the session on each request and redirects a visitor with no session from `/app` and every page under it to `/login?next=<path>`. An API route reached with no session returns 401. "Sign out" in the account menu posts to `/auth/signout`, which takes POST only, checks `Origin`, ends this browser's Supabase session with `signOut({ scope: "local" })` and redirects to `/`.

With those variables unset, accounts are off, as in local development and CI. `middleware.ts` gives each visitor an `anchored_session` cookie holding a random UUID from `crypto.randomUUID()`, and mints a new one when the value is missing or not a UUID. The cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and expires after 30 days (`SESSION_MAX_AGE_SECONDS` in `lib/session-cookie.ts`). In production it is also `Secure`. The cookie value is the only credential, so anyone who holds it can read and change that visitor's data.

Either way, a visitor sees only the businesses, choices, cards, outbox entries, chats and events that their own session created. The example business, Linden Street Kitchen, lives in code and is read-only. Choices and cards for the example are stored per session. `DELETE /api/businesses`, behind "Delete my businesses" in the account menu, runs `Store.reset` and deletes every row the session created.

## Database access

Every table has row-level security on. `20261120000000_read_only_browser_access.sql` revokes every table privilege from the `anon` and `authenticated` roles, and from tables made later. The browser's token, guests included, can read only its own `cards` rows, which Realtime needs, and the shared post playbook. It can write nothing.

`SupabaseStore` in `lib/store/supabase.ts` connects from the server with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses row-level security. The `session_id` filter in each query is what keeps one session's rows from another. Earlier migrations let a signed-in token, guests included, write its own rows directly, which skipped approval and every other server check; the read-only migration replaced those policies. `ai_usage` and `ai_session_usage` have no policy, so only the service role reads them.

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

`middleware.ts` rate-limits every `/api/*` request except GET and HEAD. Each request counts against its session and its IP, and either limit refuses it. The IP is `x-real-ip`, then the first `x-forwarded-for` entry. Vercel sets `x-real-ip` to the connecting address, so a client can't pick its bucket. `clientKey` counts an IPv6 address by its /64 prefix, since one subscriber usually holds a whole /64. `lib/server/rate-limit.ts` holds the fixed-window counter.

`clientIp` reads those headers only when `VERCEL=1`, which Vercel sets, or `TRUST_PROXY_HEADERS=1`. Set `TRUST_PROXY_HEADERS` only behind a proxy that sets `x-real-ip` or replaces `x-forwarded-for`; anywhere else a client writes the headers itself and could pick a new bucket for every request. With the headers untrusted or missing, `limitChecks` keys by session alone:

- A request that arrived with a valid session cookie or a signed-in account counts under its session limit only.
- A request that arrived with no session, such as a client that drops its cookie, a signed-out visitor or a webhook, could mint a new session each time. All of these share one bucket per route at the per-IP limit, so cookie dropping can't escape the limits, at the cost of such requests from different clients limiting each other.

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

`getBudgetedLlm` in `lib/server/ai-budget.ts` wraps the configured provider for one session. Before each model call it runs `use_session_ai_call`, a SQL function from `20261120000100_ai_session_budget.sql` that adds one to the session's row for today in `ai_session_usage` and reports whether the count is still under `AI_SESSION_DAILY_CALL_CAP` (default 150), so one visitor can't spend the whole day's budget. Routes pass the session from `getSessionId`; webhooks and schedulers pass the session their store lookup returned. "Delete my businesses" keeps today's count, so it can't refill the budget. A call within the session's cap then runs `use_ai_call`, a SQL function from `20261107000500_ai_budget_and_chat_policies.sql` that adds one to today's row in `ai_usage` and reports whether the count is still under `AI_DAILY_CALL_CAP` (default 2,000, and 0 turns model calls off). The increment and the comparison are one statement, so concurrent calls can't overshoot, and every server instance shares the count. The day is UTC.

Past the cap, onboarding, the intake chat and the business chat fall back to the rules, and a rewrite returns 429. The provider's own spend cap stays the backstop.

## Discovery agent

`fetchPage` in `lib/server/fetch-page.ts` loads a web page, and a visitor can choose the address. `POST /api/businesses` with `from: "answers"` loads the owner's website, and `npm run discover` loads vendor sites. Before each request, `fetchPage` checks the URL text: http or https only, the default port, no user name, and no localhost, `.local`, `.internal`, single-label host, IPv6 literal or private IPv4 literal. It then resolves the host with `dns.lookup` and refuses it if any address is private, loopback, link-local, carrier-grade NAT, unspecified, multicast, documentation or reserved, in IPv4 or IPv6. `isPublicAddress` allows only IPv6 global unicast, so `::1`, `fc00::/7`, `fe80::/10`, mapped IPv4 (`::ffff:a.b.c.d`) and NAT64 (`64:ff9b::/96`) are refused. It follows redirects by hand, at most three, and runs the same checks on each hop before requesting it. It drops replies that aren't HTML, are over 2 MB or take over 10 seconds. One gap remains: `fetch` resolves the host again after the check, so a DNS server that changes its answer between the two lookups can still reach a private address. Page text is untrusted: the prompts mark it as data, and `vetCandidates` in `lib/domain/discovery.ts` keeps a tool only when its source is a page the run loaded and that page names it. Nothing the agent finds gets a score or reaches an owner's page until a person reviews the change to `lib/domain/discovered.json`.

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
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' <supabase origin>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

`connect-src` adds the origin of `NEXT_PUBLIC_SUPABASE_URL` when accounts are on, because the browser calls Supabase Auth directly for sign-in. `script-src` and `style-src` allow `'unsafe-inline'` because Next.js renders inline hydration scripts and styles. `img-src` allows `blob:` because chat photo previews are `blob:` URLs from `URL.createObjectURL`. `next/font/google` downloads the fonts at build time and serves them from the app, so `font-src 'self'` covers them. Development builds send no CSP and no HSTS, because the Next.js dev server runs code with `eval`. `poweredByHeader: false` drops the `X-Powered-By` header.

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
- `CONNECTOR_SECRET_KEY`, `RESEND_API_KEY`, `INBOUND_EMAIL_SECRET` and `CRON_SECRET`, which [Connected services](#connected-services) covers.
- `GOOGLE_SERVICE_ACCOUNT_JSON`, the service account that reads invoice sheets.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`, when the optional Telegram bot is on.

None of these names has the `NEXT_PUBLIC_` prefix, so Next.js never puts them in the browser bundle. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design, and row-level security limits what it reaches. `.gitignore` excludes `.env` and `.env*.local`, and `.env.example` lists the names with empty values. Each module in `lib/server/`, `lib/llm/` and `lib/connectors/` that reads a secret or calls the store or a provider imports `server-only`, so a client component that imports one fails the build. The helpers that the edge middleware shares with the server and the browser import nothing, `server-only` included: `lib/server/origin.ts`, `lib/server/rate-limit.ts`, `lib/session-cookie.ts`, and `config.ts`, `paths.ts`, `session-id.ts` and `viewer.ts` in `lib/auth/`. `lib/architecture.test.ts` enforces that list, and also fails any `"use client"` file that imports `lib/server`, `lib/store`, `lib/llm`, `lib/connectors` or `server-only`.

## Model calls

The model writes text only. Code sets every workflow, path, score and send decision, and checks every reply:

- `enrichProfile` in `lib/server/ai.ts` rewrites a rules-built profile's text during onboarding. Code trims and caps each field, and a failure keeps the rules-built profile. The prompt wraps the owner's answers in `<owner_answers>` tags and tells the model to treat them as information, not instructions.
- `rewriteInVoice` redrafts a card. `newFacts` throws away a rewrite that adds a URL, email address, phone number, dollar amount or other number the draft did not have, and the route returns 422. Code adds back the "Reply STOP to opt out." line if the rewrite dropped it. The rewrite is saved only if the card is still pending when the model answers.
- `lib/server/intake-ai.ts` and `lib/server/business-chat.ts` read chat answers into profile changes. Code validates each change against the allowed lists, and any model failure falls back to the rules for that turn.
- `extractDetails` in `lib/server/extract.ts` reads profile details from an owner's answer or a website. The source sits in `<source_data>` tags marked as data. Code parses each value with the same rules as the gap questions, drops any fact whose quote isn't in the source, and retries once when the reply has the wrong shape. Text that `looksLikeSessionNotes` flags, such as coaching notes or a call transcript, is never sent.
- A detail from a source never overrules the owner. `mergeCandidate` in `lib/domain/details.ts` ranks the owner's words first, then documents, then the listing or website, then reviews. A disagreeing source is kept as a conflict for the owner to settle.

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

Every business uses `OWNER_TIME_ZONE`, `America/New_York`. Consent depends on who sends. When Anchored sends a text through the owner's connected Twilio number, `deliveryFor` in `lib/domain/contacts.ts` requires a contact with a consent record and no STOP reply, and the dispatcher checks again at send time. When the owner sends it from their own phone, `decideCard` still passes `hasConsent: true`, so the consent rule in `checkSend` never refuses that hand-off.

An approved card writes a row to the `outbox` table, or to memory under `MemoryStore`. When the business has connected the service and `deliveryFor` allows it, the row is queued and Anchored sends it, as [Connected services](#connected-services) describes. Otherwise the row is the owner's to send. It offers the owner an `sms:` or `mailto:` link, built in `components/business/handoff.ts`, that opens the owner's own texting or email app with the approved text typed out; the owner presses send there. The text goes into the link through `encodeURIComponent`, so it can't add a recipient or a header. A text held for quiet hours gets no link until its send time passes, so the link can't skip the hold.

## Connected services

An owner can connect a Twilio number for texts and missed calls, email in and out, and Stripe invoices. `lib/connectors/` holds one adapter per service, and `lib/server/dispatch.ts` is the one code path that sends through them.

- **Credentials are encrypted.** `encryptSecret` in `lib/server/secrets.ts` seals each connected secret, such as a Twilio auth token or a Stripe signing secret, with AES-256-GCM under `CONNECTOR_SECRET_KEY`, 32 random bytes in base64. The database holds only ciphertext, and no page or API response shows a secret back. With no key set, a service that needs a secret can't be connected.
- **Only signed-in email or Google accounts can connect.** A guest's only credential is a cookie, and the retention job deletes guest rows after 30 days. `ANCHORED_ALLOW_GUEST_CONNECTIONS=1` lifts this for local runs only.
- **Each webhook proves who sent it.** Twilio requests must carry an `X-Twilio-Signature` that matches HMAC-SHA1 under the owner's auth token, checked by `verifyTwilioRequest` in `lib/connectors/twilio.ts`. Stripe events must carry a `Stripe-Signature` that matches HMAC-SHA256 under the endpoint's signing secret, signed within the last 5 minutes so a captured event can't be replayed. Postmark's inbound email has no signature, so its URL carries `INBOUND_EMAIL_SECRET`, which the route compares in constant time with `sameSecret`. The signature checks compare in constant time too.
- **A webhook finds its business only by hook id.** `newHookId` in `lib/server/secrets.ts` gives each connection 24 random lower-case letters and digits, which its webhook URL or forwarding address carries. The route finds the business with `Store.findConnection`, never through a session. The shared Telegram bot works the same way: a customer link carries the business's own random `telegram_hook_id`, `Store.findTelegramHook` finds the business from it, and `Store.findTelegramChat` finds which business a chat last opened. `telegram_chats` and `telegram_updates` have row-level security on and no policy, so only the server reads them.
- **STOP and START replies update the contact.** A STOP reply marks the contact opted out and a START reply clears it. `deliveryFor` and the dispatcher never text an opted-out number.
- **Calls are never recorded.** Maryland requires every party's consent to record a call, so the voice webhook answers with `twimlSayAndHangUp`, which at most says a short message before it hangs up, and nothing records or transcribes the call.
- **The scheduled sender needs a secret.** `GET /api/cron/dispatch` sends due rows only for a request with `Authorization: Bearer <CRON_SECRET>`.
- **The sender sends only what was approved.** `dispatchEntry` refuses an outbox row whose card isn't approved, and a row with no card unless it is a Telegram rule's fixed message.
- **Owners send email with their own Resend key.** An owner pastes a Resend API key and a from-address on a domain they verified in Resend; the key is encrypted like other credentials. `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` set one shared sender as a fallback for a self-hosted server with one business. Leave them unset on a public deployment: with a shared sender, anyone who signs up can email any address from your domain.
- **Photos stay in the owner's folder.** The photo route finds the business in the caller's session before it reads, `SupabaseStore` refuses any path part that isn't a plain id, and each business keeps at most 60 photos.

## Recorded work and Telegram

Telegram is optional. It stays off unless the server sets `TELEGRAM_BOT_TOKEN`, and it has not been verified in production.

- **Recorded work stays in its session.** The follow-up and license routes take the session from the server, read their bodies through `readBody` with a Zod schema, and share the `agentWork` rate limit in `middleware.ts`. A contact or follow-up must belong to the current business. A saved date or source creates approval cards only.
- **Follow-ups are stored like the other owner data.** `customer_followups` has row-level security, both stores filter it by session and business, `reset` clears it, and deleting a business deletes its follow-ups. License dates live in the versioned profile and follow its retention.
- **Two lookups read across sessions, on purpose.** `listBriefTargets` returns business and session pairs for the brief and recorded-work schedulers, and every later read and write uses that session. `telegramUpdateDone` returns only whether one update id is finished. An update still in progress gets a 503, so Telegram retries it until the work is saved.
- **An uncertain Telegram send is never repeated blindly.** Every Telegram send except a protocol notice checks the allergy lock again. A timeout, a transport error or an unreadable success reply marks the send uncertain. It fails, and the owner is asked to check the conversation. A 429 or a server error may be retried once. A database failure after Telegram accepted the message also reports the send as uncertain.
- **Removing a message checks the stored record.** The delete route takes only an outbox id and an explicit confirmation. It checks the session and business, the sent status, the 48-hour window and the server settings before it claims the removal. The chat and message ids come from storage, never from the request. The sent text stays for the record, and a removed message may already have been read. A removal that crashes midway stays marked in progress for someone to check, and never reports success.

## Known limits

- Rate limits apply per server instance, not across the deployment. The AI call budget is the one deployment-wide limit.
- With accounts off, the session cookie is the only credential.
- `POST /api/ingest/[source]`, the event simulator, still trusts the session. Real events arrive only through the signed webhooks under `/api/hooks/`.
- Anchored sends a text only with a consent record, but the owner's own-phone hand-off still passes `hasConsent: true`, so the owner is trusted to have consent for what they send themselves.
- The CSP allows inline scripts, so it does not block an injected inline script. React escapes rendered text, and no component sets raw HTML.
- Retention runs only after someone schedules `purge_expired_demo_data()` with `pg_cron`.
- Requests with neither `x-real-ip` nor `x-forwarded-for` share the `unknown` rate-limit bucket.
