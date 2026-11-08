# Marketing agent: 2-hour build

Nov 8, 2026 · branch `marketing_agent` · owner Pramukh

Built from `Anchored Agent System Design V2.md` (Agent 3: Marketing) and `pramukh_tasks.md` (section 4), checked against the code on `main` at `b240085`.

## What the agent does

Marketing (`content`, shown as "Content and Social") keeps the business visible. It drafts posts about one real thing the business did, and drafts replies to reviews. A bad review also gets a flag for the owner. It publishes nothing itself. The owner approves a draft, taps Copy, and pastes it where it goes.

**Character.** The neighbor who tells the business's story: proud of the work, specific, never salesy. It writes about one real thing per post, thanks reviewers for what they mentioned, and stays calm with bad reviews. **Never:** invents a price, an award or a guarantee, names a customer without permission, offers anything in return for a rating, or argues with a reviewer. Each of these is enforced in code (MK2, MK3), not only in the prompt.

**Skills it owns** (both already exist in `lib/domain/agents.ts`):

| Skill | Starts when | Drafts |
| --- | --- | --- |
| Post Drafter (`posts`) | A weekly tick, a finished job, or the owner asking in Chat | One post per channel the business uses |
| Review Drafter (`reviewdrafter`) | A new review, simulated or pasted | A reply, plus an owner flag when the review is bad |

## What exists today

| Piece | Where | State |
| --- | --- | --- |
| `posts` and `reviewdrafter` skills, `content` core agent | `lib/domain/agents.ts` | Exists. No `character` yet; that comes with the groundwork PR (G1) |
| Template drafts `CARD_TEMPLATES.posts` and `.reviewdrafter` | `lib/domain/cards.ts` | Exist. Rules-written, channel `list`, action "Copy post". These stay as the fallback |
| `review` event (`author`, `text`) | `lib/server/ingest.ts` | Exists. Fans out to `reviewdrafter` and `reviewer`. No rating field |
| Chat cues for posts and review replies | `lib/domain/requests.ts` lines 116 to 118 | Exist. Posts and review replies are already "public only", so no customer agent stands in |
| Profile fields `reach`, `tools`, `details.promoteFocus`, `details.reviewLink`, `details.prices`, `voice`, `details.examples` | `lib/domain/types.ts` | Exist. There is no field for the owner's Google or social page URLs |
| Cron | `app/api/cron/dispatch` only | No `vercel.json`, no posts cron |
| Review retention | none | The 30-day purge is new |

## Where the data comes from (no Google or Meta for the demo)

| Source | Status | Use |
| --- | --- | --- |
| **Owner tells Chat**: "Write a post about the furnace we put in on Elm St" / pastes a review with "reply to this" | Build (MK11) | Main demo path. Works for guests, no setup |
| **Simulator** `review` (with an optional rating) and a new `job-done` event | Extend (MK4) | Backup if anything fails live |
| **Weekly tick** from Vercel Cron, plus a "Run now" route | Build (MK6) | Shows the agent working without the owner asking |
| **Shared record**: paid invoices from Bookkeeping, past bookings, Eric's thread messages | Read (MK2, MK13) | Real things to write about |
| Google Business Profile API | Later | Needs a verified profile at least 60 days old and an approved access application |
| Meta (Instagram, Facebook) | Later | Needs business verification and App Review |

```
Weekly tick ───────┐
job-done / invoice-paid ┼──> buildPostContext (code) ──> model writes one post per channel ──> checkPost ──(fail)──> template
Owner asks in Chat ┘                                                                              │
                                                                                                  └──> posts card (list, "Copy post")
review event / pasted review ──> reviewTone (code) ──> model writes reply ──> checkReply ──(fail)──> template
                                        └─ bad ──> owner flag card + flagThread on the matching contact (after Eric lands)
Owner approves ──> decideCard ──> outbox row (list channel, never sent to a customer) ──> Copy + destination link
pg_cron daily ──> purge_review_text() blanks review text older than 30 days
```

---

## Data we need for ingestion

Everything the agent reads, where it comes from, and what code does with it. Nothing outside this list reaches the model.

### Business profile (already collected at onboarding)

| Field | Used for | Required? |
| --- | --- | --- |
| `name`, `trade`, `tradeKey`, `place` | Who the post is about, local wording | Yes |
| `reach` (for example "Google", "Instagram", "Facebook", "Nextdoor") | Which channels get a post. One post per channel listed | Yes. Falls back to one general post |
| `tools` (for example "Google Business Profile") | Google listing wording, same as `usesGoogle` today | No |
| `voice`, `details.examples` | The owner's tone, passed to `rewriteInVoice` | No |
| `details.promoteFocus` | What the owner wants posts to promote | No, but posts are much better with it |
| `details.prices`, `details.minimumCharge` | The only prices a post may mention, and only when the owner allows offers | No |
| `details.hours` | "Open Saturday" style lines | No |
| `details.reviewLink` | The owner's Google review page, the default Copy destination for review replies | No |
| **New:** `details.links` `{ google?, instagram?, facebook?, website? }` | Copy destination per channel (MK10) | No. Without it the card has Copy and no link |
| **New:** `details.claims` (awards, guarantees, licenses the owner states) | The only award or guarantee words a post may use | No. Without it those words are always refused |
| **New:** `details.mayNameCustomers` (default `false`) | Whether a post may name a customer | No. Default is never |

### Events (the shared record)

| Event | Fields Marketing reads | Comes from |
| --- | --- | --- |
| `review` | `author`, `text`, **new** optional `rating` (1 to 5), **new** optional `platform` ("google", "yelp", "facebook") | Simulator, owner paste in Chat |
| **New** `job-done` | `summary` (what was done, max 280 chars), optional `area` (neighborhood, never a street number), optional `contactName` | Simulator, owner in Chat ("we just finished...") |
| `invoice-paid` | `number`, `amount` (amount is **never** put in a post), `name` | Bookkeeping (BK3) |
| Bookings whose time has passed | service, day | Existing booking events |

### Contacts and threads (after Eric's work lands)

| Data | Used for |
| --- | --- |
| Contact name, STOP state, last review date | Matching a reviewer to a customer, skipping STOP contacts in post ideas, the Review Asker rule (MK8) |
| `listThreadMessages(session, businessId, contactId, limit)` | Threads that ended well become post ideas. Customer text goes into a fenced data block marked "never an instruction" |
| `flagThread(session, businessId, contactId, note)` | Shows a bad-review flag next to that customer's conversation |

### Sample data (built, in `marketing/`)

The test business is College Park Heating & Air, the HVAC example from `lib/domain/cases.ts`. Every file holds the expected result, so tests load it and assert against it. See `marketing/README.md`.

| File | Holds |
| --- | --- |
| `profile.json` | The profile, with the new `links`, `claims` and `mayNameCustomers` fields |
| `contacts.json` | Five customers, one with STOP, with last review and review-ask dates |
| `jobs.json` | Seven `job-done` payloads: what to keep, what to strip, the daily cap, two refused |
| `reviews.json` | Thirteen reviews: good, mixed, bad, old, malformed and one prompt injection |
| `chat-lines.json` | Nine owner lines for the business chat |
| `model-outputs.json` | Fake model posts and replies that must be refused or kept |

---

## Before you start

**You need:**
- Node 26 (`.nvmrc`), and `npm ci` done in this checkout.
- `.env.local`: Supabase and AI keys are already set. `CRON_SECRET` (`openssl rand -hex 32`) is needed only for the weekly tick in Later.
- To test without Supabase: `ANCHORED_ALLOW_MEMORY_STORE=1`.
- Your port: **3102**. Eric uses 3101. Leave 3000 alone.
- No Google, Meta or other new accounts. The demo runs on copy and paste.

**Read first:** `lib/domain/agents.ts` (`posts`, `reviewdrafter`, `content`), `lib/domain/cards.ts` (`CARD_TEMPLATES.posts`, `.reviewdrafter`, `postLine`, `usesGoogle`), `lib/server/ingest.ts` (`SOURCE_SKILLS`, `PAYLOADS`, `ingestEvent`), `lib/domain/requests.ts` (the cues on lines 116 to 118 and `publicOnly`), `lib/server/ai.ts` (`rewriteInVoice` and its fact check), `lib/server/ai-budget.ts`, `lib/llm/json.ts`, `supabase/migrations/20261107000400_retention_keeps_accounts.sql` (the purge pattern), `app/api/cron/dispatch/route.ts` (the cron auth pattern).

**Repo rules:** every Store method lands in `types.ts`, `memory.ts` and `supabase.ts`, and `reset` clears anything new. A deployment-wide Store method must return each row's session id and be listed in `AGENTS.md` and `docs/architecture.md`. Migrations are append-only, and yours is `20261108000500_marketing_reviews.sql`. New mutation routes get a `LIMITS` entry in `middleware.ts` and a schema in `lib/api/schemas.ts`. Every model call goes through `getBudgetedLlm`. Every file gets a `Module Overview` banner and every export a `/** */` line. No em or en dashes.

**Shared files** (`ingest.ts`, `types.ts`, `requests.ts`, `business-chat.ts`, `decide.ts`, `data.ts`, `lib/store/**`, `lib/api/**`, `middleware.ts`, `docs/architecture.md`, `AGENTS.md`): additive edits only, and tell Eric before you touch one. `vercel.json` is yours; add Eric's brief cron entry when he asks.

---

## The 2-hour build

This is sized for **one person working alone**, with no parallel agents, so it holds even if nobody else is free. Everything that doesn't fit is under [Later](#later), with its full instructions kept.

**What you'll have at the end:** a review comes in, code decides whether it's good, mixed or bad, the model writes a reply that code checks, and a bad review also gets a flag for the owner. A finished job comes in, code strips names and street numbers and refuses made-up claims, and a template post about that real job lands in Approvals. Every card still waits for the owner, and nothing goes to a customer.

**What's left out:** the model writing posts (posts stay template-written), the weekly schedule, Copy links, chat parsing, the 30-day review purge and anything that needs Eric's work.

| Stage | Subtasks | Time | Checkpoint |
| --- | --- | --- | --- |
| 1. Review rules | MK1 character, MK3 trimmed | 35 min | `reviews.test.ts` passes against `marketing/reviews.json` and the reply cases in `marketing/model-outputs.json` |
| 2. Post rules | MK2 trimmed | 35 min | `posts.test.ts` passes against `marketing/profile.json`, `jobs.json` and the post cases in `model-outputs.json` |
| 3. New events and template posts | MK4, template change | 20 min | The simulator takes a `job-done` event and a review with a star rating, and refuses the broken ones in the sample data |
| 4. Review replies and flags | MK7 trimmed | 30 min | In the browser, a good review gives one reply card and a bad one gives a reply card plus a flag card, with AI on and with AI off |
| **Total** | | **2 hours**, plus about 10 minutes to finish | `npm run check` passes |

Each stage builds on the one before it and ends in something you can test on its own. If time runs out, stop at the end of any stage: what's built is complete and tested.

### Stage 1. Review rules (35 min)

**MK1. Marketing character (10 min).** Give `content` its `character`: the role line, the voice rules and the four `never` limits from [What the agent does](#what-the-agent-does). Add `characterPrompt("content")` if the groundwork PR (G1) hasn't. If G1 has landed, only check the wording.

**MK3, trimmed (25 min).** New `lib/domain/reviews.ts`, no I/O:
- `reviewTone(text, rating?)`: `"good" | "mixed" | "bad"`. The rating wins when given (4 to 5 good, 3 mixed, 1 to 2 bad). Without one, negative-word rules decide. Code decides, never the model.
- `checkReply(text, review)`: refuses offers ("discount", "free", "coupon", "credit", "% off", "next visit on us"), arguing ("actually", "you're wrong", "that's not true", "never happened"), and any reply over 600 characters.

Cut to Later: `reviewDetail` (the model picks the detail to thank them for instead), the name and number check in `checkReply`, and `mayAskForReview`.

**Files:** `lib/domain/agents.ts`, `lib/domain/agents.test.ts`, new `lib/domain/reviews.ts`, `lib/domain/reviews.test.ts`.

**Checkpoint:**
```bash
npx vitest run lib/domain/agents.test.ts lib/domain/reviews.test.ts
```
Every review in `marketing/reviews.json` gets its expected `tone`, including the 1-star review with almost no text. Every reply under `replies.refuse` in `marketing/model-outputs.json` is refused with a plain reason, and every reply under `replies.pass` is kept.

### Stage 2. Post rules (35 min)

**MK2, trimmed.** New `lib/domain/posts.ts`, no I/O:
- `channelsFor(profile)`: the channels to draft for, from `reach` and `tools` (Google, Instagram, Facebook), or one general channel.
- `cleanJobSummary(summary, profile, contacts)`: removes street numbers and customer names unless `mayNameCustomers` is on.
- `checkPost(text, profile, job?)`: refuses any price or number not in the profile or the job, award and guarantee words ("award", "#1", "best in", "top rated", "guarantee", "guaranteed") unless `details.claims` holds them, customer names, links not in `details.links`, and offers ("% off", "discount", "free") unless `promoteFocus` names that offer.
- `postKey(businessId, now)`: `posts:<businessId>:job:<YYYY-MM-DD>`, so there's at most one finished-job post per day.

In the 2-hour build, `checkPost` guards the owner's and the simulator's job summaries before they go into a template post. When the model writes posts later (MK5), the same check runs on its output.

Add the three optional `ProfileDetails` fields, `links`, `claims` and `mayNameCustomers`, to `lib/domain/types.ts` (shared, additive). Tell Eric the names.

Cut to Later: `buildPostContext` with threads and bookings, and the weekly post key.

**Files:** new `lib/domain/posts.ts`, `lib/domain/posts.test.ts`, `lib/domain/types.ts`.

**Checkpoint:**
```bash
npx vitest run lib/domain/posts.test.ts
```
`channelsFor` on `marketing/profile.json` returns Google, Instagram and Facebook. Job 2 in `jobs.json` loses "14" and "John Park". Every post under `posts.refuse` in `model-outputs.json` is refused and every one under `posts.pass` is kept.

### Stage 3. New events and template posts (20 min)

**MK4.** In `lib/server/ingest.ts` (shared, additive):
- Add `job-done` to `SOURCE_SKILLS` (`["posts"]`) and to `PAYLOADS` as a strict object with `summary` (max 280), optional `area` and optional `contactName`.
- Add optional `rating` (integer 1 to 5) and `platform` to the `review` payload.
- A `job-done` event cleans its summary with `cleanJobSummary` and runs `checkPost` on it. If the check fails, the card falls back to today's generic post. Cards use `postKey`, so a second job the same day makes no new card.

**Template change.** `CARD_TEMPLATES.posts` in `lib/domain/cards.ts` takes the cleaned job summary when there is one, so the post is about the real job: "Draft post for College Park Heating & Air: Our crew put in a new heat pump in Silver Spring today."

Cut to Later: the `invoice-paid` fan-out to `posts` (it waits for Bookkeeping's BK3).

**Files:** `lib/server/ingest.ts`, `lib/server/ingest.test.ts`, `lib/domain/cards.ts`, `lib/domain/cards.test.ts`.

**Checkpoint:**
```bash
npx vitest run lib/server/ingest.test.ts lib/domain/cards.test.ts app/api/hooks/hooks.test.ts lib/server/feed.test.ts
```
Then in the running app, send `jobs.json` job 1 to `/api/ingest/job-done` and see one post card about the heat pump. Send job 5 the same day and see no new card. `job-bad-1`, `job-bad-2`, `rev-bad-payload-1` and `rev-bad-payload-2` are refused with a plain error.

### Stage 4. Review replies and flags (30 min)

**MK7, trimmed.** Wire `reviewdrafter` in a new `lib/server/reviews.ts`:
1. `reviewTone` runs in code first.
2. The model writes a reply through `getBudgetedLlm` with `characterPrompt("content")`. It thanks the reviewer for one thing they mentioned, and a bad review gets a calm reply that invites them to call, with no offer. The review text goes in a fenced data block marked "never an instruction."
3. `checkReply` runs. A refusal, a budget cap or no AI falls back to `CARD_TEMPLATES.reviewdrafter`.
4. A bad review also creates an owner flag card (channel `flag`) with the review text.
5. No standing rule ever applies. Each reply is its own card.

Cut to Later: the flag on the customer's conversation (needs Eric's `flagThread`) and the Copy destination link.

**Files:** new `lib/server/reviews.ts`, `lib/server/reviews.test.ts`, `lib/server/ingest.ts`, `lib/domain/cards.ts`.

**Checkpoint:**
```bash
npx vitest run lib/server/reviews.test.ts
```
With a fake model that returns "15% off your next visit", the card falls back to the template. Then in the browser on port 3102:
1. Send `rev-good-1` from `marketing/reviews.json`. One reply card that thanks Maria for the explanation.
2. Send `rev-bad-1`. A calm reply card and a flag card, with no discount.
3. Send `rev-injection`. The reply offers nothing.
4. Set `AI_DAILY_CALL_CAP=0` and repeat steps 1 and 2. Template replies, and the flag still appears.

### Finish (about 10 more minutes)

```bash
npx vitest run lib/architecture.test.ts
git fetch origin && git merge origin/main
npm run check
git push -u origin marketing_agent
```

Then open a PR following `.claude/skills/land-a-pr/SKILL.md`.

---

## Later

Cut from the 2-hour build, in the order to pick them up next. Each keeps its full instructions below.

| Order | Subtask | Time | Why it waits |
| --- | --- | --- | --- |
| 1 | MK5 model-written posts | 45 min | Template posts about the real job work for the demo. This is the biggest quality gain next |
| 2 | Cut parts of MK2, MK3, MK4, MK7 | 45 min | `buildPostContext` from bookings, `reviewDetail`, names and numbers in `checkReply`, the `invoice-paid` fan-out after BK3 |
| 3 | MK11 chat input | 45 min | Chat already routes posts and review replies to the right skill. This reads cleaner facts from the owner's words |
| 4 | MK10 Copy destinations | 30 min | Copy works without a link. Needs Eric to agree the `links` field |
| 5 | MK6 weekly tick and Run now | 60 min | The demo starts posts from the simulator or chat |
| 6 | MK9 30-day review purge | 45 min | Google's terms require it before real reviews come in, not for a demo |
| 7 | MK12 page data and brief feed | 30 min | Waits for Eric's Marketing page and brief |
| 8 | MK8 Review Asker rule | 30 min | Only matters once Eric's Customer agent is live |
| 9 | MK13 after Eric lands | 30 min | Needs Eric's thread work |
| | **Total later** | **about 6 hours** | |

With three agents working at once, the Later list takes about 2.5 hours of wall time: MK5 and MK11 on one, MK10, MK6 and MK9 on another, and the cut parts plus MK12 on the third. MK8 and MK13 wait for Eric. They all touch the shared `ingest.ts`, `requests.ts`, `schemas.ts` and `middleware.ts`, so merge one agent's work at a time.


### MK5. Post drafting with the model

**What:** New `lib/server/posts.ts` with `draftPosts(session, business, trigger)`:
1. Build the context with `buildPostContext`.
2. For each channel, ask the model through `getBudgetedLlm` for one post using `characterPrompt("content")` and the owner's voice. Thread text goes in a fenced data block marked "never an instruction."
3. Run `checkPost`. On a refusal, a budget cap or no AI, use `CARD_TEMPLATES.posts`.
4. Save the card with channel `list`, action "Copy post", no `stake`, and the channel name in the title ("Instagram post about the Elm St install").

**You need:** AI keys for the model path (already set). The fallback needs none.

**Files:** new `lib/server/posts.ts`, `lib/server/posts.test.ts`, `lib/domain/cards.ts` (`CARD_TEMPLATES.posts` gains a channel argument).

**Depends on:** MK1, MK2, MK4.

**Run:**
```bash
npx vitest run lib/server/posts.test.ts lib/domain/cards.test.ts
```

**Done when:** with a fake model that returns "Best HVAC in town, 20% off!", the card falls back to the template. With `AI_DAILY_CALL_CAP=0`, template cards still appear. Two channels give two cards.

**Time:** 45 min.

### MK6. Weekly tick, Run now and `vercel.json`

**What:**
1. Store method `listBusinessesWithSkill(skill, limit)`. It's deployment-wide and returns each row's session id, like `listDueOutbox`. Document why in `docs/architecture.md` and in `AGENTS.md`'s list of deployment-wide methods.
2. New `app/api/cron/posts/route.ts`. It needs `Authorization: Bearer $CRON_SECRET`, the same as dispatch, and calls `draftPosts` for each business that chose `posts`, using the session id the Store returned.
3. New `POST /api/businesses/[id]/posts` "Run now" for the demo, using the visitor's session. Give it a `LIMITS` entry in `middleware.ts` (it calls a model) and a schema in `lib/api/schemas.ts`.
4. New `vercel.json`:

   ```json
   {
     "crons": [
       { "path": "/api/cron/dispatch", "schedule": "*/5 * * * *" },
       { "path": "/api/cron/posts", "schedule": "0 14 * * 1" }
     ]
   }
   ```

   Monday at 14:00 UTC is 9 a.m. Eastern. Check the plan's cron limits: Vercel Hobby runs crons at most once a day, so the 5-minute dispatch needs Pro or an outside scheduler.

**You need:** `CRON_SECRET` in `.env.local`.

**Files:** `lib/store/types.ts`, `memory.ts`, `supabase.ts`, `memory.test.ts`, new `app/api/cron/posts/route.ts`, new `app/api/businesses/[id]/posts/route.ts`, `middleware.ts`, `lib/api/schemas.ts`, `vercel.json`, `docs/architecture.md`, `AGENTS.md`.

**Depends on:** MK5.

**Run:**
```bash
npx vitest run lib/store/memory.test.ts lib/architecture.test.ts
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/posts
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/posts   # second run, no new cards
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3102/api/cron/posts            # 401
```

**Done when:** the cron makes one card per channel per business per week, a second run makes none, a call without the secret gets 401, and session A's run never touches session B's cards.

**Time:** 60 min.

### MK8. No double contact with Review Asker

**What:** Pure rule `mayAskForReview(contact, events, now)` in `lib/domain/reviews.ts`: no Review Asker card if that contact left a review in the last 90 days, or already got an ask for the same job. Call it in ingest before drafting `reviewer`, including the `invoice-paid` fan-out.

**You need:** nothing external. Tell Eric, since it changes when his Customer agent's skill fires.

**Files:** `lib/domain/reviews.ts`, `lib/domain/reviews.test.ts`, `lib/server/ingest.ts` (shared).

**Depends on:** MK3, MK4.

**Run:**
```bash
npx vitest run lib/domain/reviews.test.ts lib/server/ingest.test.ts
```

**Done when:** a contact who reviewed 10 days ago gets no ask on `invoice-paid`, and one who reviewed 100 days ago does.

**Time:** 30 min.

### MK9. 30-day review retention

**What:** Migration `20261108000500_marketing_reviews.sql`:
1. `purge_review_text()`, `security definer`, `set search_path = public`. It blanks the review text in `events` where `source = 'review'` and in the bodies of `reviewdrafter` cards, for rows older than 30 days. It runs for **every** session, accounts included, unlike `purge_expired_demo_data`, because the limit comes from Google's terms. It returns the counts.
2. A comment below it with the pg_cron line to run once:

   ```sql
   select cron.schedule('purge-review-text', '15 3 * * *', $$select purge_review_text()$$);
   ```

3. `MemoryStore` applies the same cutoff when reading reviews, so tests can cover it.

**You need:** Supabase access to apply it: `npx supabase link --project-ref bbtxbipjkubauevtfpqe`, then `npx supabase db push`, or paste the file into the Dashboard SQL Editor. pg_cron must be enabled on the project.

**Files:** `supabase/migrations/20261108000500_marketing_reviews.sql`, `lib/store/memory.ts`, `lib/store/memory.test.ts`.

**Depends on:** nothing. It can run alongside MK2.

**Run:**
```bash
npx vitest run lib/store/memory.test.ts
```

Then in the SQL Editor, insert a review event dated 31 days ago and run `select purge_review_text();`.

**Done when:** the 31-day-old review is blank, a 29-day-old one is untouched, the counts come back, and an account's review is purged too.

**Time:** 45 min.

### MK10. Copy action and destination links

**What:**
- `destinationFor(profile, channel)` in `lib/domain/posts.ts` returns the URL from `details.links` (or `reviewLink` for review replies), or `null`.
- Outbox rows for Marketing cards carry it, so Eric's Copy button can link to it. List-channel rows are never sent to a customer.
- Onboarding or the profile editor needs a place for the owner to enter `links`. That screen is Eric's; agree the field names with him.

**You need:** Eric's agreement on the field.

**Files:** `lib/domain/posts.ts`, `lib/server/decide.ts` (shared, additive), `lib/api/contract.ts` (shared).

**Depends on:** MK2.

**Run:**
```bash
npx vitest run lib/domain/posts.test.ts lib/server/decide.test.ts
```

**Done when:** an approved Instagram post's outbox row carries the Instagram URL, one without a link carries `null`, and no Marketing row is ever dispatched to a customer.

**Time:** 30 min.

### MK11. Chat input (main demo path)

**What:** In the business chat:
- "Write a post about the furnace we put in on Elm St" makes a `job-done` event with that summary (street number stripped), then a post card.
- "Reply to this review: ..." with pasted text makes a `review` event. A star count in the text ("1 star", "5/5") becomes `rating`.
- "Post that we're open Saturday" uses the owner's words as the post's one real thing.

The existing cues already route these to `posts` and `reviewdrafter`. The new work is reading the facts out of the owner's words, and keeping only values that appear in them.

**You need:** nothing external. It works with AI off (rules) and on (the model may write the words only).

**Files:** `lib/domain/requests.ts` (shared), `lib/domain/requests.test.ts`, `lib/server/business-chat.ts` (shared), `lib/server/business-chat.test.ts`.

**Depends on:** MK4, MK5, MK7.

**Run:**
```bash
npx vitest run lib/domain/requests.test.ts lib/server/business-chat.test.ts
```

**Done when:** each chat line in `chat-lines.txt` makes the expected card, a pasted review with "2 stars" makes a reply and a flag, and "write a post" with nothing to say asks "What did you finish or want to share this week?" and makes no card.

**Time:** 45 min.

### MK12. Marketing page data and brief feed

**What:** Read functions in `lib/server/data.ts` for Eric's Marketing page:
- the character and enabled skills
- posts waiting and recently copied posts
- review replies waiting and open review flags

Also a brief feed: posts waiting, posts copied this week, review flags open. Every number is computed in code. Agree on the shapes with Eric in writing first.

**You need:** Eric's agreement on the shapes.

**Files:** `lib/server/data.ts` (shared), `lib/server/data.test.ts`, `lib/api/contract.ts` (shared).

**Depends on:** MK5, MK7.

**Run:**
```bash
npx vitest run lib/server/data.test.ts
```

**Done when:** tests prove the counts match the cards, and session A can't see session B's counts.

**Time:** 30 min.

### MK13. After Eric's branches land

**What:**
- Feed good threads from `listThreadMessages` into `buildPostContext`, skipping STOP contacts.
- When a bad review's author matches a contact, call `flagThread(session, businessId, contactId, note)` so the flag shows next to that conversation.
- Check that Review Asker respects `mayAskForReview` on Telegram too.

**You need:** Eric's Telegram channel and thread work merged.

**Files:** `lib/server/posts.ts`, `lib/server/reviews.ts`.

**Run:**
```bash
npx vitest run lib/server/posts.test.ts lib/server/reviews.test.ts
```

**Time:** 30 min.

### Cut parts of MK2, MK3, MK4 and MK7

- **MK2:** `buildPostContext(profile, events, threads, now)` reads services, `promoteFocus`, finished jobs from `job-done` and `invoice-paid` (amounts dropped), bookings that have passed, and good threads (STOP contacts skipped). Add the weekly key `posts:<businessId>:<YYYY-Www>` with MK6.
- **MK3:** `reviewDetail(text)` returns one specific thing the reviewer mentioned, or `null`. `checkReply` also refuses any number or name not in the review or profile. `mayAskForReview` is MK8.
- **MK4:** add `posts` to the `invoice-paid` fan-out next to Bookkeeping's `reviewer`, once BK3 lands.
- **MK7:** when a bad review's author matches a contact, call Eric's `flagThread`. That's MK13. The Copy destination is MK10.

---

## Other things to decide before building

1. **Where the owner enters page links and claims.** `links`, `claims` and `mayNameCustomers` are new `ProfileDetails` fields. Onboarding and the profile editor are Eric's screens, so agree on the names before MK2. Until then, the sample profile sets them by hand.
2. **Groundwork order.** MK1 assumes G1 (characters, `characterPrompt`) lands first. If it hasn't, do MK1 here and keep it in the same shape so the groundwork PR merges cleanly.
3. **Bookkeeping overlap.** Both agents add to the `invoice-paid` fan-out in `ingest.ts`. Land BK3 first, or agree that whichever lands second adds its skill to the list.
4. **Vercel plan.** The 5-minute dispatch cron needs Vercel Pro or an outside scheduler. The weekly posts cron works on any plan.
5. **Photos.** Posts are text only in v1. Photo prompts ("add a photo of the finished unit") can be a line in the card, not an upload.
6. **Timezone.** The weekly tick is one UTC time for every business. Per-business local times can come later.
7. **Later integrations.** Google Business Profile (reviews in, replies and posts out) and Meta posting stay out of scope. When they come, every reply and post is still a card the owner approves.
8. **Privacy.** Review text is purged at 30 days. Job summaries never keep street numbers or customer names unless the owner turned naming on.
