# Marketing agent: subtasks

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

### Sample data to build (`marketing/` folder)

For a test business such as an HVAC contractor:

1. `profile.json`: `reach` with Google and Instagram, `promoteFocus`, two prices, `links`, `claims` with one real license line, `mayNameCustomers: false`.
2. `jobs.json`: five `job-done` payloads, one of which mentions a customer name and a street address (must be stripped).
3. `reviews.json`: eight reviews. Three good with a specific detail, two mixed, two bad (one names a visit), one with no text but a 1-star rating.
4. `chat-lines.txt`: owner lines to paste, such as "write a post about the new heat pump install", "reply to this review: ...", "post that we're open Saturday".
5. `bad-model-outputs.json`: replies and posts that must be refused (a "$25 off" reply, "best HVAC in Maryland", a named customer, "you're wrong about the wait"). These feed the MK2 and MK3 tests.

---

## Before you start

**You need:**
- Node 26 (`.nvmrc`), and `npm ci` done in this checkout.
- `.env.local`: Supabase and AI keys are already set. Add `CRON_SECRET` (`openssl rand -hex 32`) to test the posts cron by hand.
- To test without Supabase: `ANCHORED_ALLOW_MEMORY_STORE=1`.
- Your port: **3102**. Eric uses 3101. Leave 3000 alone.
- No Google, Meta or other new accounts. The demo runs on copy and paste.

**Read first:** `lib/domain/agents.ts` (`posts`, `reviewdrafter`, `content`), `lib/domain/cards.ts` (`CARD_TEMPLATES.posts`, `.reviewdrafter`, `postLine`, `usesGoogle`), `lib/server/ingest.ts` (`SOURCE_SKILLS`, `PAYLOADS`, `ingestEvent`), `lib/domain/requests.ts` (the cues on lines 116 to 118 and `publicOnly`), `lib/server/ai.ts` (`rewriteInVoice` and its fact check), `lib/server/ai-budget.ts`, `lib/llm/json.ts`, `supabase/migrations/20261107000400_retention_keeps_accounts.sql` (the purge pattern), `app/api/cron/dispatch/route.ts` (the cron auth pattern).

**Repo rules:** every Store method lands in `types.ts`, `memory.ts` and `supabase.ts`, and `reset` clears anything new. A deployment-wide Store method must return each row's session id and be listed in `AGENTS.md` and `docs/architecture.md`. Migrations are append-only, and yours is `20261108000500_marketing_reviews.sql`. New mutation routes get a `LIMITS` entry in `middleware.ts` and a schema in `lib/api/schemas.ts`. Every model call goes through `getBudgetedLlm`. Every file gets a `Module Overview` banner and every export a `/** */` line. No em or en dashes.

**Shared files** (`ingest.ts`, `types.ts`, `requests.ts`, `business-chat.ts`, `decide.ts`, `data.ts`, `lib/store/**`, `lib/api/**`, `middleware.ts`, `docs/architecture.md`, `AGENTS.md`): additive edits only, and tell Eric before you touch one. `vercel.json` is yours; add Eric's brief cron entry when he asks.

---

## Subtasks

Each subtask lists what it is, what you need, the files, what to run, and when it's done.

### MK1. Marketing character

**What:** Give `content` its `character`: the role line, the voice rules and the four `never` limits above. Add `characterPrompt("content")` if G1 didn't already add the helper.

If the groundwork PR (G1) has landed on `main`, only check the wording and that each `never` line has a code check in MK2 or MK3.

**You need:** nothing external.

**Files:** `lib/domain/agents.ts`, `lib/domain/agents.test.ts`.

**Depends on:** G1, or nothing if you do it here.

**Run:**
```bash
npx vitest run lib/domain/agents.test.ts
```

**Done when:** a test proves `content.character.never` has four entries and every prompt `posts` and `reviewdrafter` send includes the voice rules.

**Time:** 15 min.

### MK2. Post rules (pure domain)

**What:** New `lib/domain/posts.ts`, no I/O:
- `channelsFor(profile)`: the channels to draft for, from `reach` and `tools` (Google, Instagram, Facebook, Nextdoor), or one general channel.
- `buildPostContext(profile, events, threads, now)`: services, `promoteFocus`, finished jobs from `job-done` and `invoice-paid` (amounts dropped), bookings that have passed, good threads (STOP contacts skipped). Customer names and street numbers are removed unless `mayNameCustomers` is on.
- `checkPost(text, context)`: returns `{ ok: true }` or `{ ok: false, reason }`. It refuses any price or number not in the context, award and guarantee words ("award", "#1", "best in", "top rated", "guarantee", "guaranteed") unless `details.claims` holds them, any customer name when naming isn't allowed, links not in `details.links`, and offers ("% off", "discount", "free") unless `promoteFocus` names that offer.
- `postKey(businessId, trigger, now)`: `posts:<businessId>:<YYYY-Www>` for the weekly tick, `posts:<businessId>:job:<YYYY-MM-DD>` for finished jobs, so each fires at most once.

**You need:** nothing external. No keys.

**Files:** new `lib/domain/posts.ts`, `lib/domain/posts.test.ts`, new optional fields in `ProfileDetails` in `lib/domain/types.ts` (shared, additive): `links`, `claims`, `mayNameCustomers`.

**Depends on:** nothing. **Start here.**

**Run:**
```bash
npx vitest run lib/domain/posts.test.ts
```

**Done when:** tests cover every refusal in `bad-model-outputs.json`, a name stripped from a job summary, a STOP contact's thread left out, a week key that is the same on Monday and Sunday, and a profile with no `reach` giving one channel.

**Time:** 60 min.

### MK3. Review rules (pure domain)

**What:** New `lib/domain/reviews.ts`, no I/O:
- `reviewTone(text, rating?)`: `"good" | "mixed" | "bad"`. The rating wins when given (4 to 5 good, 3 mixed, 1 to 2 bad). Without one, negative-word rules decide. Code decides, never the model.
- `reviewDetail(text)`: one specific thing the reviewer mentioned (a person, a service, a moment), so the reply can thank them for it. Returns `null` when there's nothing specific.
- `checkReply(text, review)`: refuses offers ("discount", "free", "coupon", "credit", "% off", "next visit on us"), arguing ("actually", "you're wrong", "that's not true", "never happened"), any number or name not in the review or profile, and a reply over 600 characters.

**You need:** nothing external.

**Files:** new `lib/domain/reviews.ts`, `lib/domain/reviews.test.ts`.

**Depends on:** nothing. It can run alongside MK2.

**Run:**
```bash
npx vitest run lib/domain/reviews.test.ts
```

**Done when:** all eight sample reviews get the expected tone, the 1-star empty review is bad, and every refused reply in `bad-model-outputs.json` fails with a plain reason.

**Time:** 45 min.

### MK4. Events: `job-done`, review rating, finished-job fan-out

**What:** In `lib/server/ingest.ts`:
- Add `job-done` to `SOURCE_SKILLS` (`["posts"]`) and to `PAYLOADS` as a strict object with `summary`, optional `area` and optional `contactName`.
- Add optional `rating` (integer 1 to 5) and `platform` to the `review` payload.
- Add `posts` to the `invoice-paid` fan-out next to Bookkeeping's `reviewer` (coordinate with BK3 so you add to the same list, not replace it).
- Cap finished-job posts at one per business per day with `postKey`.

The simulator picks the new source up from `EVENT_SOURCES` with no extra work.

**You need:** MK2 for `postKey`. If BK3 hasn't landed, add `invoice-paid` yourself in the same shape Bookkeeping uses.

**Files:** `lib/server/ingest.ts` (shared), `lib/server/ingest.test.ts`.

**Run:**
```bash
npx vitest run lib/server/ingest.test.ts app/api/hooks/hooks.test.ts lib/server/feed.test.ts
```

**Done when:** a `job-done` event makes one `posts` card, a second one the same day makes none, a `review` with `rating: 6` or an extra field is refused, and an `invoice-paid` event makes both the review ask and the post idea.

**Time:** 30 min.

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

### MK7. Review replies and bad-review flags

**What:** Wire `reviewdrafter`:
1. `reviewTone` and `reviewDetail` run in code first.
2. The model writes a reply that thanks the reviewer for that detail. Bad reviews get a calm reply that invites them to call, with no offer. `checkReply` runs; any refusal falls back to `CARD_TEMPLATES.reviewdrafter`.
3. A bad review also creates an owner flag card (channel `flag`) with the review text and, if known, the visit it mentions.
4. The reply card's Copy destination is `details.reviewLink`, or the platform's link from `details.links`.
5. No standing rule ever applies. Google requires prior, specific consent for automated review replies, so each reply is its own card.

**You need:** AI keys for the model path.

**Files:** `lib/server/ingest.ts` (shared), `lib/domain/cards.ts` (`CARD_TEMPLATES.reviewdrafter`), new `lib/server/reviews.ts` + test.

**Depends on:** MK1, MK3, MK4.

**Run:**
```bash
npx vitest run lib/server/reviews.test.ts lib/domain/cards.test.ts
```

**Done when:** a good review gets one reply card that names the detail, a bad review gets a reply card plus a flag card, and a fake model reply with "15% off your next visit" falls back to the template.

**Time:** 45 min.

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

---

## How long it takes

| Subtask | Time |
| --- | --- |
| MK1 character | 15 min |
| MK2 post rules | 60 min |
| MK3 review rules | 45 min |
| MK4 events | 30 min |
| MK5 post drafting | 45 min |
| MK6 weekly tick and Run now | 60 min |
| MK7 review replies and flags | 45 min |
| MK8 Review Asker rule | 30 min |
| MK9 retention migration | 45 min |
| MK10 Copy destinations | 30 min |
| MK11 chat input | 45 min |
| MK12 page data and brief | 30 min |
| MK13 after Eric lands | 30 min |
| Sample data folder | 30 min |
| **Total, one person in order** | **about 9 hours** |

## Running 3 agents

Give each agent its own git worktree off `marketing_agent` so they don't edit the same checkout:

```bash
git worktree add ../mk-a -b marketing_agent-a marketing_agent
git worktree add ../mk-b -b marketing_agent-b marketing_agent
git worktree add ../mk-c -b marketing_agent-c marketing_agent
# in each: cp ../Anchored/.env.local . && npm ci
```

Merge each back into `marketing_agent` when its phase is done.

| Phase | Agent A | Agent B | Agent C | Wall time |
| --- | --- | --- | --- | --- |
| 1 | MK1 + MK2 post rules | MK3 review rules | MK9 migration + sample data | about 75 min |
| 2 (after merging phase 1) | MK4 events, then MK5 post drafting | MK7 review replies, then MK8 | MK10 Copy destinations | about 75 min |
| 3 (after merging phase 2) | MK6 weekly tick | MK11 chat input | MK12 page data | about 60 min |
| 4 | MK13 after Eric lands | | | 30 min |

That's about **3.5 to 4 hours** of wall time, plus your review and the merges. Phases 2 and 3 all touch the shared `ingest.ts`, `requests.ts`, `schemas.ts` and `middleware.ts`, so merge one agent's work at a time.

---

## Testing the whole agent

### Unit tests (no keys)

```bash
npx vitest run lib/domain/posts.test.ts lib/domain/reviews.test.ts lib/domain/cards.test.ts lib/domain/requests.test.ts lib/domain/agents.test.ts
npx vitest run lib/store/memory.test.ts lib/server/ingest.test.ts lib/server/posts.test.ts lib/server/reviews.test.ts lib/server/data.test.ts
npx vitest run lib/architecture.test.ts
```

### Manual run, AI off then on

```bash
ANCHORED_ALLOW_MEMORY_STORE=1 npm run dev -- -p 3102
```

1. Continue as a guest and open your sample business. Make sure it chose Post Drafter and Review Drafter.
2. In Chat, type `Write a post about the heat pump we installed in Silver Spring today`. Approvals shows one post per channel, with no price and no customer name.
3. Type it again. No new finished-job post today.
4. Paste `Reply to this review: Maria was on time and explained everything. 5 stars`. A reply card thanks the reviewer for the clear explanation.
5. Paste `Reply to this review: Waited 3 hours and the unit still rattles. 1 star`. A calm reply card and a flag card appear. Neither offers a discount.
6. Simulator: send `job-done` with `{"summary":"Replaced a furnace at 14 Elm St for John Park"}`. The post leaves out "14" and "John Park".
7. Approve a post. The outbox row shows Copy and the Instagram or Google link, and dispatch never sends it.
8. Run the cron twice with `curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3102/api/cron/posts`. One weekly post per channel, not two.
9. Set `AI_DAILY_CALL_CAP=0` and repeat steps 2, 4 and 5. Template drafts appear and every rule still holds.

### Before the PR

```bash
git fetch origin && git merge origin/main
npm run check
git push -u origin marketing_agent
```

Then open a PR following `.claude/skills/land-a-pr/SKILL.md`.

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
