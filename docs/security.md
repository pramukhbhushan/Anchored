# Security controls

This page lists each control that protects visitors' data, the paid model calls, and the customers who would receive a message. Each section names the file that holds the control and states its limits.

## Sessions and accounts

`getSessionId` in `lib/server/session.ts` returns the id that every `Store` method filters on. Its source depends on whether accounts are on.

With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, accounts are on. The id is the Supabase Auth user id, for email-link, Google and guest users alike. `getSessionId` gets it from `supabase.auth.getClaims()`, which checks the session token's signature and expiry against the project's published signing keys instead of trusting the cookie. A project on the legacy shared secret has no published key, so `getClaims` asks Supabase Auth instead. Because the token is checked locally, a copy of it taken before sign-out keeps working until it expires, one hour by default. `findViewer`, which the layouts and the account menu read, asks Supabase Auth with `supabase.auth.getUser()`, so a guest who confirms an email shows as signed in with it on the next page load. `middleware.ts` refreshes the session on each request and redirects a visitor with no session from `/app` and every page under it to `/login?next=<path>`. An API route reached with no session returns 401. "Sign out" in the account menu posts to `/auth/signout`, which takes POST only, checks `Origin`, ends this browser's Supabase session with `signOut({ scope: "local" })` and redirects to `/`.

With those variables unset, accounts are off, as in local development and CI. `middleware.ts` gives each visitor an `anchored_session` cookie holding a random UUID from `crypto.randomUUID()`, and mints a new one when the value is missing or not a UUID. The cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and expires after 30 days (`SESSION_MAX_AGE_SECONDS` in `lib/session-cookie.ts`). In production it is also `Secure`. The cookie value is the only credential, so anyone who holds it can read and change that visitor's data.

Either way, a visitor sees only the businesses, choices, cards, outbox entries, chats and events that their own session created. The example business, Linden Street Kitchen, lives in code and is read-only. Choices and cards for the example are stored per session. `DELETE /api/businesses`, behind "Delete my businesses" in the account menu, runs `Store.reset` and deletes every row the session created.

## Database access

Every table has row-level security on. `20261120000000_read_only_browser_access.sql` revokes every table privilege from the `anon` and `authenticated` roles, and from tables made later. The browser's token, guests included, can read only its own `cards` rows, which Realtime needs, and the shared post playbook. It can write nothing.

`SupabaseStore` in `lib/store/supabase.ts` connects from the server with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses row-level security. The `session_id` filter in each query is what keeps one session's rows from another. Earlier migrations let a signed-in token, guests included, write its own rows directly, which skipped approval and every other server check; the read-only migration replaced those policies. `ai_usage` and `ai_session_usage`, unused since the deployment stopped holding an AI key, have no policy, so only the service role reads them.

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
| `PUT` and `DELETE /api/businesses/[id]/ai-key` | 10 | 50 | Saving checks the owner's AI key with one call to their provider |
| `POST /api/intake`, `POST /api/intake/[id]` and `POST /api/businesses/[id]/chat` | 40, shared | 200, shared | Takes a chat turn, with a model call when AI is on |
| `POST /api/businesses/[id]/cards` and `POST /api/ingest/[source]` | 60, shared | 300, shared | Creates a card |
| Any other API request except GET and HEAD | 120 | 600 | Writes to the database |

All limits use a 10-minute window. Per-IP limits are five to six times looser than per-session ones, because people on one office or venue network share an address. A request over a limit gets a 429 with an `{ error }` body and a `Retry-After` header holding the seconds until the window resets.

Each server instance keeps its own counts in memory. On Vercel, a client whose requests spread over several instances gets each limit once per instance.

## Owner AI keys

An owner can save their own AI key on the Connections page, and every model call for that business then runs on it. The deployment holds no AI key of its own: `getBusinessLlm` in `lib/server/business-llm.ts` returns the business's key or none, and with none the rules write. Onboarding runs before the business exists, so the rules read it. AI settings in the environment, such as `AI_PROVIDER` and `AI_API_KEY`, do nothing; only `npm run discover` reads them, on an operator's own machine. No daily call cap applies, since every call spends the owner's money.

- **Only named providers.** The owner picks Anthropic, OpenAI, OpenRouter or Featherless, the list in `AI_PROVIDERS` in `lib/domain/connections.ts`, and `ownerProviderConfig` in `lib/llm/config.ts` always sends the key to that provider's own endpoint. An owner never types an address, since an address from a stranger could aim the server's requests at machines inside its network.
- **The key is encrypted like any connected secret.** `saveAiKey` in `lib/server/connections.ts` stores it as an `ai` connection, sealed by `encryptSecret` under `CONNECTOR_SECRET_KEY`. `settings` holds the provider, the optional model and the key's last four characters, which is all the Connections page shows. The account rule from [Connected services](#connected-services) applies: guests and the example business can't save a key, and "Delete my businesses" removes it with the other connections.
- **Saving checks the key first.** `checkOwnerKey` in `lib/server/business-llm.ts` makes one short quick-tier call. A key the provider turns down is not saved, and the owner sees why in plain words. `PUT /api/businesses/[id]/ai-key` has its own rate limit, since each try calls a model. The request schema allows only printable characters in the key, so a header error can't quote it.
- **No key text reaches a log or a page.** A provider's error can quote part of the key it refused. `withOwnerErrors` replaces every failure on an owner's key with Anchored's own words, with no provider text and no cause attached, such as "OpenAI turned down your AI key. Check it on Connections." A refused key or an account with no credit raises `AiKeyError`, which the rewrite route and the business chat show the owner. A key that can't be decrypted, for example after `CONNECTOR_SECRET_KEY` changed, logs a line with no key in it, and the rules write for the business.

## Discovery agent

`fetchPage` in `lib/server/fetch-page.ts` loads a web page. Only `npm run discover` calls it, to load vendor sites; no route does, so a visitor can't make the server fetch an address. It still guards every request. Before each request, `fetchPage` checks the URL text: http or https only, the default port, no user name, and no localhost, `.local`, `.internal`, single-label host, IPv6 literal or private IPv4 literal. It then resolves the host with `dns.lookup` and refuses it if any address is private, loopback, link-local, carrier-grade NAT, unspecified, multicast, documentation or reserved, in IPv4 or IPv6. `isPublicAddress` allows only IPv6 global unicast, so `::1`, `fc00::/7`, `fe80::/10`, mapped IPv4 (`::ffff:a.b.c.d`) and NAT64 (`64:ff9b::/96`) are refused. It follows redirects by hand, at most three, and runs the same checks on each hop before requesting it. It drops replies that aren't HTML, are over 2 MB or take over 10 seconds. One gap remains: `fetch` resolves the host again after the check, so a DNS server that changes its answer between the two lookups can still reach a private address. Page text is untrusted: the prompts mark it as data, and `vetCandidates` in `lib/domain/discovery.ts` keeps a tool only when its source is a page the run loaded and that page names it. Nothing the agent finds gets a score or reaches an owner's page until a person reviews the change to `lib/domain/discovered.json`.

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
- `CONNECTOR_SECRET_KEY` and `CRON_SECRET`, which [Connected services](#connected-services) covers.

Owners' AI keys live encrypted in the database, as [Owner AI keys](#owner-ai-keys) describes. None of these names has the `NEXT_PUBLIC_` prefix, so Next.js never puts them in the browser bundle. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design, and row-level security limits what it reaches. `.gitignore` excludes `.env` and `.env*.local`, and `.env.example` lists the names with empty values. Each module in `lib/server/`, `lib/llm/` and `lib/connectors/` that reads a secret or calls the store or a provider imports `server-only`, so a client component that imports one fails the build. The helpers that the edge middleware shares with the server and the browser import nothing, `server-only` included: `lib/server/origin.ts`, `lib/server/rate-limit.ts`, `lib/session-cookie.ts`, and `config.ts`, `paths.ts`, `session-id.ts` and `viewer.ts` in `lib/auth/`. `lib/architecture.test.ts` enforces that list, and also fails any `"use client"` file that imports `lib/server`, `lib/store`, `lib/llm`, `lib/connectors` or `server-only`.

## Model calls

The model writes text only. Code sets every workflow, path, score and send decision, and checks every reply:

- `rewriteInVoice` in `lib/server/ai.ts` redrafts a card. `newFacts` throws away a rewrite that adds a URL, email address, phone number, dollar amount or other number the draft did not have, and the route returns 422. Code adds back the "Reply STOP to opt out." line if the rewrite dropped it. The rewrite is saved only if the card is still pending when the model answers.
- `lib/server/business-chat.ts` reads chat answers into profile changes. Code validates each change against the allowed lists, and any model failure falls back to the rules for that turn.
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

An owner can connect a Twilio number for texts and missed calls, email out, and Stripe invoices. `lib/connectors/` holds one adapter per service, and `lib/server/dispatch.ts` is the one code path that sends through them.

- **Credentials are encrypted.** `encryptSecret` in `lib/server/secrets.ts` seals each connected secret, such as a Twilio auth token or a Stripe signing secret, with AES-256-GCM under `CONNECTOR_SECRET_KEY`, 32 random bytes in base64. The database holds only ciphertext, and no page or API response shows a secret back. With no key set, a service that needs a secret can't be connected.
- **Only signed-in email or Google accounts can connect.** A guest's only credential is a cookie, and the retention job deletes guest rows after 30 days. `ANCHORED_ALLOW_GUEST_CONNECTIONS=1` lifts this for local runs only.
- **Each webhook proves who sent it.** Twilio requests must carry an `X-Twilio-Signature` that matches HMAC-SHA1 under the owner's auth token, checked by `verifyTwilioRequest` in `lib/connectors/twilio.ts`. Stripe events must carry a `Stripe-Signature` that matches HMAC-SHA256 under the endpoint's signing secret, signed within the last 5 minutes so a captured event can't be replayed. The signature checks compare in constant time.
- **A webhook finds its business only by hook id.** `newHookId` in `lib/server/secrets.ts` gives each connection 24 random lower-case letters and digits, which its webhook URL carries. The route finds the business with `Store.findConnection`, never through a session.
- **STOP and START replies update the contact.** A STOP reply marks the contact opted out and a START reply clears it. `deliveryFor` and the dispatcher never text an opted-out number.
- **Calls are never recorded.** Maryland requires every party's consent to record a call, so the voice webhook answers with `twimlSayAndHangUp`, which at most says a short message before it hangs up, and nothing records or transcribes the call.
- **The scheduled sender needs a secret.** `GET /api/cron/dispatch` sends due rows only for a request with `Authorization: Bearer <CRON_SECRET>`.
- **The sender sends only what was approved.** `dispatchEntry` refuses an outbox row whose card isn't approved, and a row with no card.
- **Owners send email with their own Resend key.** An owner pastes a Resend API key and a from-address on a domain they verified in Resend, and the key is encrypted like other credentials. The server has no Resend key of its own, so email goes out only from an owner\'s own account and domain.
- **Photos stay in the owner's folder.** The photo route finds the business in the caller's session before it reads, `SupabaseStore` refuses any path part that isn't a plain id, and each business keeps at most 60 photos.

## Recorded work

- **Recorded work stays in its session.** The follow-up and license routes take the session from the server, read their bodies through `readBody` with a Zod schema, and share the `agentWork` rate limit in `middleware.ts`. A contact or follow-up must belong to the current business. A saved date or source creates approval cards only.
- **Follow-ups are stored like the other owner data.** `customer_followups` has row-level security, both stores filter it by session and business, `reset` clears it, and deleting a business deletes its follow-ups. License dates live in the versioned profile and follow its retention.
- **One lookup reads across sessions, on purpose.** `listBriefTargets` returns business and session pairs for the brief and recorded-work schedulers, and every later read and write uses that session.

## Removed features

The shared Telegram bot and forwarded email through Postmark ran on accounts the original team held, and are gone. Their tables, `telegram_chats`, `telegram_updates`, `thread_messages`, `conversation_states` and `standing_rules`, and their columns on `businesses`, `contacts` and `outbox`, stay in the database, since migrations are append-only. Nothing writes them. `SupabaseStore` skips any stored card or outbox row on the `telegram` channel and any connection of kind `email-in`, and "Delete my businesses" still clears a session's old rows.

## Known limits

- Rate limits apply per server instance, not across the deployment.
- With accounts off, the session cookie is the only credential.
- `POST /api/ingest/[source]`, the event simulator, still trusts the session. Real events arrive only through the signed webhooks under `/api/hooks/`.
- Anchored sends a text only with a consent record, but the owner's own-phone hand-off still passes `hasConsent: true`, so the owner is trusted to have consent for what they send themselves.
- The CSP allows inline scripts, so it does not block an injected inline script. React escapes rendered text, and no component sets raw HTML.
- Retention runs only after someone schedules `purge_expired_demo_data()` with `pg_cron`.
- Requests with neither `x-real-ip` nor `x-forwarded-for` share the `unknown` rate-limit bucket.
