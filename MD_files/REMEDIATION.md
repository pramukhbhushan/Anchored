# Remediation Plan: Folding Missed Design Decisions into Anchored

Companion to DESIGN.md. DESIGN.md says what the system should be; this file says what to change, in what order, and who does it, so the build matches decisions the team already made in earlier project chats but that were missing from the first version of the design.

Repo: pramukhbhushan/Anchored. This plan was written without access to the repo, so each item has a "Check first" line. Before starting an item, look at what already exists and skip or shrink the work accordingly.

Deadline context: build weekend ends with the video due Sunday, Nov 8. Priorities below are set against that.

## How to read this plan

- Priority P0: needed for the demo to show what we promised (agents morph per business, owner stays in control). Do tonight or early Sunday.
- Priority P1: makes the demo noticeably better or safer. Do Sunday if P0 is done.
- Priority P2: correct but invisible in a 10-minute video. Defer to the 16-week plan unless it is a few minutes of work.
- Owner: A (Onboarding and Business Profile), B (Agent Runtime and agents), C (Owner App, Channels, Infra), same split as DESIGN.md.
- DESIGN.md ref: the section that now describes the target behavior.

## Summary

| ID | Change | Owner | Priority | Depends on | DESIGN.md ref |
|---|---|---|---|---|---|
| R1 | Profile schema and field registry additions (vocabulary and 7 more fields, must vs nice flag) | A | P0 | none | Must-have field registry |
| R2 | Google Places API business lookup | A (server), C (picker UI) | P0 | R1 | Business lookup |
| R3 | Extraction hardening: forced tool call, zod, one retry, conflicts flagged | A | P0 | R1 | Onboarding Stage 3 |
| R4 | Agent selection with reasons (crew decision) | A | P0 | R1, R3 | Onboarding Stage 3b |
| R5 | Crew screen (on/off with reasons, turn-on button) | C | P0 | R4 | Onboarding Stage 3b |
| R6 | Neutral SKILL.md rewrite plus vocabulary injection | B | P0 | R1 | Core concepts: Neutral skills |
| R7 | Ask-don't-guess rule and missing-info path | B | P0 | R6 | Core concepts: Ask, don't guess |
| R8 | propose_card forced tool and executor-only sending | B | P0 | none | Runtime rules |
| R9 | One pending outbound message per customer | B | P0 | R8 | Runtime rules |
| R10 | Missed-call text-back before full voice AI | C (Twilio), B (reply skill) | P0 | R8 | Front Desk voice calls |
| R11 | Demo readiness: sample data per business, judge demo account, live judge onboarding | C (lead), all | P0 | R2 to R10 | Build plan Phase 8 |
| R12 | Gap questions without stock defaults, sourced suggestions only | A (logic), C (UI) | P1 | R1, R3 | Onboarding Stage 4 |
| R13 | Confirm screen: conflicts, edit in place, profile versioning | C (UI), A (versioning) | P1 | R3 | Onboarding Stage 4b |
| R14 | Card edits flow back into the profile | B (diff), A (field mapping) | P1 | R8, R13 | Core concepts: Card |
| R15 | agent_configs assembly with owner examples and I/O channel | B | P1 | R1, R6 | Core concepts: Agent config |
| R16 | Handoff state machine (Front Desk to Follow-Up quote) | B | P1 | R8, R9 | Agent runtime design |
| R17 | Supabase Realtime card feed | C | P1 | R8 | Runtime rules |
| R18 | Marketing "copy caption and open Instagram" output | B (schema), C (button) | P1 | R8 | Agent table |
| R19 | Internal Comms: real daily brief, sample data for triage and staff | B | P1 | R8 | Agent table |
| R20 | Readiness messages with next step and preview through the real card pipeline | A (readiness), B (preview) | P1 | R4, R8 | Onboarding Stage 5 |
| R21 | Model map with Opus tier for multi-step work | B | P2 | none | Agent table |
| R22 | Raw input storage for re-running extraction | A | P2 | none | Onboarding Stage 2 |
| R23 | Exclude coaching session notes from ingestion | A | P2 | R3 | Data storage and protection |

## Schedule

| Block | Teammate A | Teammate B | Teammate C |
|---|---|---|---|
| Sat night, first 2 hours | R1 (merge contracts first, everyone pulls), then R2 server route | R8, R9 | R10 Twilio side, R2 picker UI stub |
| Sat night, after | R3, R4 | R6, R7, R10 reply skill | R5 |
| Sun morning | R12, R13 versioning, R20 readiness | R16, R15, R20 preview | R13 UI, R17, R11 sample data |
| Sun early afternoon | R14 field mapping, R23 if time | R14 diff, R18, R19 | R18 button, R11 judge account and script |
| Sun afternoon | Freeze. End-to-end runs on 3 businesses plus one unseen business. Record fallback run, then the video. | | |

Rule for the freeze: anything not passing its acceptance check by then gets cut from the demo and moves to the 16-week plan. Do not record the video on a half-working feature.

## Contract changes (merge first)

These are the seams between A, B, and C. Merge them in one PR before anyone builds on them.

Business Profile schema (zod), new fields:

| Field | Type | Must or nice | Used by |
|---|---|---|---|
| owner_name | string | must | All |
| vocabulary | object: customer, work_unit, price_term, booking_term | must | All |
| urgent_criteria | string list | must | Front Desk, Internal Comms |
| top_faqs | list of {q, a} | nice | Front Desk |
| price_drivers | string list (what changes the price) | must if pricing_method is quote | Front Desk, Follow-Up |
| minimum_charge | money | nice | Follow-Up, Bookkeeping |
| lead_definition and desired_next_step | string, enum (book_call, send_estimate, book_visit, other) | must | Follow-Up |
| reminder_firmness | enum (gentle, standard, firm) | must | Bookkeeping |
| promote_focus | string list (what to promote) | must | Marketing |
| examples | list of {kind: quote, post, message, text} | nice | per agent |
| place_id | string | n/a | Onboarding |

Every field keeps the existing wrapper: value, source_type, source_quote, confidence, owner_confirmed. Add source_type value "places_listing" (website tier) and keep "reviews" as the lowest tier.

New shared types:

- CrewDecision: { agent_type, on: boolean, reason: string, trigger_quote?: string }
- GapQuestion: { field_key, prompt, format_example, suggestion?: { value, source_type, source_quote } }
- Card adds: profile_fields_used (list of field_key), edit_map (which card fields map to which profile fields, for R14)
- Handoff: { to_agent, reason, summary } (unchanged if already built)

Database migration (Supabase):

```sql
alter table businesses add column place_id text;
alter table businesses add column profile_version int not null default 0;

create table profile_versions (
  business_id uuid references businesses(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  changed_by text not null,          -- 'onboarding', 'owner', 'card_edit'
  created_at timestamptz default now(),
  primary key (business_id, version)
);

create table crew_decisions (
  business_id uuid references businesses(id) on delete cascade,
  agent_type text not null,
  is_on boolean not null,
  reason text not null,
  trigger_quote text,
  primary key (business_id, agent_type)
);

create table agent_configs (
  business_id uuid references businesses(id) on delete cascade,
  agent_type text not null,
  skill_version text not null,
  profile_slice jsonb not null,
  limits jsonb not null,
  examples jsonb not null default '[]',
  model text not null,
  input_source text not null,
  output_channel text not null,
  primary key (business_id, agent_type)
);

create table raw_inputs (               -- R22, optional this weekend
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  kind text not null,                   -- 'transcript', 'website', 'photo', 'places'
  storage_path text not null,
  created_at timestamptz default now()
);

alter table conversations add column pending_card_id uuid;   -- R9

-- RLS: enable on every new table with the same business_id policy as existing tables.
```

If tables with these jobs already exist under other names, add the columns there instead of creating duplicates.

## Items

### R1. Profile schema and field registry additions

Why: without the vocabulary field, agents use generic words and the "same agent, different business" demo falls flat. The other fields come from the per-agent must-have table we agreed on.

Check first: does /packages/contracts (or equivalent) already define the profile schema and registry? If so, add fields; do not restructure.

Changes:
- Add the fields in the contract table above.
- Add a must or nice flag per field per agent in the registry. Readiness counts only must fields.
- Update the extraction prompt's field list so the new fields can be filled.

Acceptance: the three sample businesses each produce a filled vocabulary object (for example HVAC: customer "homeowner", work_unit "service call"; restaurant: "guest", "order"; coaching: "client", "session").

### R2. Google Places API business lookup

Why: the owner types a name instead of finding and pasting a link, and we get hours, address, phone, rating, and up to 5 reviews before they say a word.

Check first: is a website or GBP link extractor already built? Keep it as the fallback path.

Changes:
- Server route POST /api/onboarding/lookup: Text Search with "name, city", return top 3 {place_id, name, address, rating}.
- Server route POST /api/onboarding/place: Place Details for the chosen place_id with a field mask limited to displayName, formattedAddress, regularOpeningHours, nationalPhoneNumber, websiteUri, types, editorialSummary, rating, userRatingCount, reviews. Smaller field masks cost less.
- Map fields per the table in DESIGN.md. Reviews go to the reviews tier only.
- If websiteUri exists, queue the website extractor too.
- Store only place_id long-term. Everything else becomes candidates until the owner confirms them (R13).
- Picker UI (C): "Is this you?" with 3 results and a "Not listed, paste my website" option.
- Key: server-side env var, restricted to Places API in Google Cloud console, daily quota cap.

Acceptance: typing a real local business name and city returns the right listing in the top 3, and its hours and phone appear as candidates on the confirm screen with source "places_listing".

Risk: Google Maps Platform terms restrict caching Places content. Check them before any real launch; the confirm-then-store-as-owner-confirmed approach is the planned mitigation.

### R3. Extraction hardening

Why: free-form extraction drifts and breaks the merge step.

Check first: is extraction already returning value, quote, and confidence per field?

Changes:
- Call Claude (Sonnet tier) with the profile schema as a forced tool call (tool_choice set to that tool).
- Validate with zod. On failure, retry once with the validation error in the message. On second failure, mark that source as failed and continue with the others.
- Merge in code by precedence: owner words > documents > places_listing and website > reviews, then confidence.
- When two sources disagree on a field, keep both candidates and set conflict: true. Do not pick silently.
- Wrap all fetched or uploaded text in delimited blocks marked as data.

Acceptance: feeding a website that says "open until 6" and a transcript that says "we close at 8" yields hours with value from the transcript, conflict: true, and both quotes kept.

### R4. Agent selection with reasons

Why: this is our answer to the challenge's "discover and compare." Judges will look for it.

Check first: is agent selection a hard-coded rule set? Keep the rules; add the reasons.

Changes:
- Code rules on the five facts produce the first on/off pass (for example, pricing_method = quote turns on Follow-Up quoting; customers reach by calls or texts turns on Front Desk).
- One Claude call maps the owner's pain points, in their own words, to agents and writes a one-line reason per agent, on or off, with the quote that triggered it.
- Code validates: only the 5 real agent types, every agent has a reason, and the model cannot turn on an agent the rules hard-excluded without a quote to justify it.
- Save to crew_decisions.

Acceptance: for each sample business, every agent has a reason that cites something the owner or a source actually said.

### R5. Crew screen

Changes:
- One card per agent: name, one-line job, on/off, the reason, and readiness (from R20).
- Off agents show a "Turn on" button. Turning one on adds its must-have fields to the gap questions.
- One-line descriptions that keep the boundaries clear, for example "Internal Communications: handles your inbox, your staff, and your daily brief."

Acceptance: on a phone-width screen, an owner can see why each agent is on or off and turn an off agent on in one tap.

### R6. Neutral SKILL.md rewrite plus vocabulary injection

Why: business-specific words in skills are hidden presets, which we ruled out.

Check first: grep the skills folder for "job", "reservation", "appointment", "table", "service call", "client", "session". Every hit is a rewrite.

Changes:
- Rewrite each SKILL.md in neutral terms: a request, a customer, the price, a booking.
- The prompt builder injects the business's vocabulary object and instructs the agent to use those words with customers.
- Add a CI check or test that fails if a SKILL.md contains words from a banned list.

Acceptance: the same Front Desk skill, run on the three sample businesses, produces replies using "service call", "order", and "session" respectively, with no business-specific code paths.

### R7. Ask-don't-guess rule

Why: this is the agreed mitigation for the no-presets risk.

Changes:
- Add to every SKILL.md: if a needed fact is not in the profile slice, ask the customer or flag the owner; never invent prices, times, or policies.
- Add a missing_info output variant to each agent's output schema: { ask_customer?: string, flag_owner?: string, missing_field: field_key }.
- A flag_owner result becomes a flag card that links to the gap question for that field.
- Policy guard check: any price in an outbound message must exist in price_list or fall inside pricing_ranges, or the card is blocked.

Acceptance: deleting the price list from a sample profile and sending "how much for X?" produces "I'll confirm the price" plus a flag card, never a number.

### R8. propose_card forced tool and executor-only sending

Why: makes "nothing goes out without a tap" true by construction rather than by prompt.

Check first: do agents currently call send_sms or similar tools directly? If so, remove those tools from agent tool lists.

Changes:
- Agents get exactly one action tool: propose_card. Tool choice forces it.
- A single executor module is the only code that imports Twilio, Stripe, Gmail, or calendar send functions. Add a lint rule or test that fails if any other module imports them.
- The executor runs only on approved cards (or live-and-within-limits actions, per DESIGN.md), uses idempotency keys, and writes the audit log.

Acceptance: a grep for the Twilio client import finds it only in the executor and gateway modules.

### R9. One pending outbound message per customer

Changes:
- conversations.pending_card_id holds the one open outbound card for that customer.
- If an agent proposes a second outbound card while one is pending, the new card replaces the old one (old marked superseded) rather than stacking.
- Clear pending_card_id on approve, reject, or execute.

Acceptance: sending three texts quickly from one test number produces one pending card for that customer, not three.

### R10. Missed-call text-back first

Why: it works reliably on stage, it is useful by itself, and it was the agreed first step for Front Desk.

Changes:
- Twilio voice webhook: ring owner or staff for about 20 seconds (Dial with timeout). On no-answer, busy, or after hours, play a short message and hang up, then trigger a missed_call event.
- Front Desk handles missed_call by proposing a text: a greeting in the business's voice asking how it can help.
- During the demo with the agent in live mode for this action type, the text sends immediately; otherwise it is a card.
- Full voice AI (DESIGN.md steps 2 to 7) stays the next step and becomes a stretch goal if time runs out.

Acceptance: calling the demo number and not answering produces a text to the caller within 15 seconds and a conversation owned by Front Desk.

### R11. Demo readiness

Changes:
- Sample data per business: a few customers, 2 or 3 completed jobs or orders, 1 overdue invoice, 2 owner photos. Bookkeeping and Marketing need these to show anything.
- Judge demo account: a seeded login with no real data, plus a "start fresh" button that runs onboarding for a business the judge describes.
- Demo script: onboard two very different businesses live (or one live, one pre-recorded), show the crew screens side by side, then trigger a missed call.
- Video narrative maps to the challenge words: discover (onboarding and crew), compare (reasons and preview cards), adopt (preview, test, live).
- 16-week plan section in the video lists every P2 and cut item from this file.

Acceptance: someone outside the team can open the link, onboard a business we have never seen, and get a sensible crew and at least one good preview card.

### R12. Gap questions without stock defaults

Changes:
- Remove any hard-coded default values (for example "$89 is common").
- GapQuestion.suggestion is set only when a candidate exists with a source quote; the UI shows "From your website: open 9 to 5. Correct?"
- Otherwise show the prompt with a format example: "Your usual price range, like $100 to $300."
- Group questions to keep the count low; ask only must fields for agents that are on.

Acceptance: a business with no website gets questions with format examples and zero invented values.

### R13. Confirm screen and profile versioning

Changes (C): one screen listing profile fields grouped by agent, conflicts highlighted with both sources shown, tap to edit.
Changes (A): on confirm, write a profile_versions row with a full snapshot, bump businesses.profile_version, and mark confirmed fields owner_confirmed: true with source_type owner.

Acceptance: editing hours on the confirm screen creates version 2, and version 1 is still readable.

### R14. Card edits flow back into the profile

Changes:
- Each card carries edit_map, for example { "price": "pricing_ranges", "greeting": "brand_voice" }.
- When the owner edits a mapped field and approves, the diff updates that profile field (source owner, confidence high) and writes a new profile version with changed_by card_edit.
- Unmapped edits only change that one message.

Acceptance: changing a quoted price on a preview card updates pricing_ranges, and the next quote uses the new value.

### R15. agent_configs assembly

Changes:
- After confirm, build one agent_configs row per active agent: skill version, profile slice (only its fields), limits, 2 or 3 examples from the owner's own material if provided, model from the model map, input_source, output_channel.
- The runtime reads agent_configs, not the full profile, when building prompts.

Acceptance: the Marketing config for a business that uploaded past posts contains those posts as examples; the Front Desk config contains no Bookkeeping fields.

### R16. Handoff state machine

Changes:
- States per conversation: front_desk, follow_up, bookkeeping, closed. Allowed transitions defined in code.
- Front Desk emits a handoff when the customer asks for a price that requires a quote; Follow-Up drafts the quote.
- Reject transitions not in the table and log them.

Acceptance: a texted "how much to replace my unit?" moves the conversation from Front Desk to Follow-Up and yields a quote card that respects R7 and R9.

### R17. Supabase Realtime card feed

Changes: subscribe the card inbox to inserts and updates on cards filtered by business_id. RLS still applies.

Acceptance: a card created by a test event appears on the phone without a refresh.

### R18. Marketing output

Changes: Marketing card's approve action is "Copy caption and open Instagram" (copies text, opens the app or site) unless the Meta connector is live. Photos attach from storage.

Acceptance: approving a post card copies the caption and opens Instagram on a phone.

### R19. Internal Comms scope for the weekend

Changes:
- Daily brief built from real app data: counts and highlights from cards, conversations, and invoices in the last 24 hours.
- Inbox triage and staff coordination run on seeded sample emails and staff messages unless Gmail is connected.
- The brief reports on other agents; it never creates actions for them.

Acceptance: after a demo run, the brief correctly reports what the other agents did.

### R20. Readiness and preview through the real pipeline

Changes:
- Readiness shows must fields filled over required, plus a next-step line for the first missing field ("Follow-Up needs your price list. Snap a photo?").
- Preview scenarios are generated from the profile (not a fixed HVAC script) and run through the same event, router, agent, guard, and card path as live traffic, with output marked preview.

Acceptance: a restaurant's Front Desk preview is a restaurant scenario, and it appears in the same card component as live cards.

### R21. Model map with Opus tier

Changes: one file mapping task type to model: Haiku 5.5 for triage, short rewording, live voice turns; Sonnet 5.5 for drafts and extraction; Opus 5.5 only for multi-step work. Check exact model IDs against current API docs.

### R22. Raw input storage

Changes: save transcript, fetched page text, Places response, and photo to private storage with a raw_inputs row, so extraction can be re-run when the schema changes. Delete voice audio after transcription as already planned.

### R23. Exclude coaching session notes

Changes: the extractor ignores uploads or text that look like session notes or call content; mention this boundary in the pitch.

## Risks introduced by these changes

| Risk | Mitigation |
|---|---|
| Contract changes break in-progress work | Merge R1 and the contract types first, in one PR, before other items start |
| Places lookup returns the wrong business | 3-result picker plus website fallback; owner confirms every value |
| Places API cost or key leak | Field masks, server-side restricted key, daily quota cap |
| Neutral skills read as bland | Vocabulary injection plus owner examples (R15) carry the specificity |
| Too much for one night | P0 first; anything failing its check at freeze is cut and moved to the 16-week plan |

## Suggested GitHub issues

One issue per R item, titled "R#: short name", labeled onboarding (A), runtime (B), or app (C), plus P0, P1, or P2. Pin the R1 contracts issue so everyone sees it first. Link each issue to its DESIGN.md section.
