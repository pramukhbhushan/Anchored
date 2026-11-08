# Agent presentation integration

The workspace and navigation use session-scoped `getChoices`, `activeAgents` and `getFeed` reads. Customer groups the legacy Front Desk and Follow-up records for display; the canonical identity migration remains Pramukh's work. Production pages do not import test fixtures. Main's workflow map, setup chat and automation pages remain in place alongside the agent workspaces.

## Connected behavior

Each workspace embeds its own ChatWindow. GET uses the validated `agent` query and POST uses the validated `agent` body field. Server membership checks restrict the context to active agents and selected skills. Histories are namespaced under the existing session-filtered business threads. Conversational answers use getBudgetedLlm with business facts and recent scoped history, without tools. Drafts still use readRequest and the existing approval path. Missing or failed AI is labeled explicitly.

| UI surface | Current implementation | Limits |
| --- | --- | --- |
| Customer history | `CustomerThreads` receives `CustomersResponse` from `customerThreads` and `GET /api/businesses/[id]/customers?contact=<id>`. Contact selection stays in the URL. Messages include card links, delivery results and rule provenance | Reads are scoped to the current session and business. Another business's contact is never selected. A failed read is an error, not an empty successful conversation |
| Telegram link | `telegramSetup` and `GET /api/businesses/[id]/telegram` return the real business link or an unavailable reason | Guest-owned businesses are supported. The shared example never receives a live inbox. Bot credentials stay on the server |
| QR | `TelegramQr` uses the approved `qrcode` dependency on the server | The image encodes the actual business link locally, with no external QR service |
| Acknowledgment | `AcknowledgmentRuleControl` calls `PUT /api/businesses/[id]/standing-rules` and keeps the server's saved response | Fixed text, on by default, at most once per contact per 12-hour window. Turning it off cancels queued acknowledgments, and dispatch checks again before sending |
| Daily brief | `BriefRun` calls `POST /api/businesses/[id]/brief`; GET reads the last successful run. Internal and Overview read that persisted state | Counts and wording come from code. Manual and scheduled runs share the claim. A failed run keeps the previous successful snapshot and watermark |
| Telegram outbox | The approval and dispatch paths persist real Telegram delivery results. The outbox and Customer history show those results | `decide.ts` owns outbox writes and `dispatch.ts` owns provider calls. Telegram has no personal SMS, email or copy-and-send fallback |
| Rule provenance | Outbox rows and thread messages distinguish acknowledgment and protocol notices from approved replies | A fixed `/start` or `/stop` confirmation is a protocol notice. It is never described as an owner-approved draft |
| Forwarded email | The existing authenticated Postmark hook calls Internal triage. Customer emails become one-off cards; unsupported handoffs become owner notes | No automatic email response is sent. Real Postmark-to-production verification is still outstanding |

Quiet hours and the opt-out suffix apply to SMS. Telegram and email can send at any hour after the applicable approval or fixed-rule authorization. Consent, STOP, allergy locks, current Telegram binding and bot blocking are rechecked by the server. An approval never grants the browser authority to choose a recipient or bypass those checks.

## Recorded work and removal

| Capability | Connected contract | Server guarantees |
| --- | --- | --- |
| Recorded follow-ups | `FollowupSchedule` uses `GET`, `POST` and `PUT /api/businesses/[id]/followups` | Records explicit due time, job state, source id and evidence. Code accepts only chosen skills and the business's own contacts. Telegram customer drafts recheck STOP, locks and touch limits. Debrief is an owner flag. Stable card keys prevent duplicate work, and cancellation invalidates old work at approval and dispatch |
| License dates | `LicenseDates` uses `GET` and `PUT /api/businesses/[id]/licenses`, returning the authoritative `licenses` list | Structured facts live in `ProfileDetails.licenses` and versioned profile history. Required source evidence, real civil dates and completion state drive owner-only 30-day, 7-day, expiry-day and overdue notices in America/New_York. Completion, removal or changed dates supersede stale pending flags |
| Telegram removal | `DeleteTelegramMessage` calls `POST /api/businesses/[id]/outbox/[entry]/delete` with `{ "confirm": true }` | Eligibility is computed on the server from a stored sent-message identity and the 48-hour window. The dispatcher claims deletion atomically, calls Telegram, and stores removal separately from delivery. Sent text and history remain; someone may already have read the message |

`lib/server/agent-work.ts` checks recorded facts when they are saved, during the existing dispatch cron, and before Run now counts the brief. No extra cron entry is required. Scheduling creates owner cards, not outbox messages. The server never guesses dates, open slots, prices or completed jobs from prose. Declining or canceling work cannot be bypassed by an old approved card.

The new append-only migrations are `20261108000700_telegram_deletion.sql` and `20261108000800_customer_followups.sql`. They remain unapplied to live Supabase. Pramukh must review and apply them manually before deploying this version; the existing team's incomplete migration history makes an unreviewed `supabase db push` unsafe.

The safety audit also tightened uncertain-send handling and webhook claims. A Telegram provider timeout does not trigger a blind repeat send. An update already being processed returns a retryable 503 rather than acknowledging unfinished work as completed. Completed updates remain deduplicated.

## Contracts still owned by Pramukh

| Capability | Required contract | Behavior before it arrives |
| --- | --- | --- |

| Canonical identities and character | `CoreAgentId`, `canonicalAgent`, `ConversationOwner` and character metadata | The view groups `frontdesk` and `followup` as Customer. Existing skill/job/limit metadata remains visible |
| Billing handoff | `createHandoffCard(session, business, { toSkill, parentKey, contactId, facts })` | Customer billing questions and forwarded billing become owner notes |
| Supplier invoices | `receiveSupplierInvoice` with authoritative source and business linkage | Forwarded supplier mail becomes an owner note |
| Marketing review handoff | The shared handoff helper and Marketing receiver | Forwarded review material becomes an owner note |
| Bookkeeping and Marketing reads | Scoped feeds for agent pages and brief numbers | Existing feed cards and truthful unavailable states remain; no invented specialized statistics |
| Review follow-on | Authoritative completed-job linkage and the agreed paid/job event contract | No job completion or review request is inferred from an arbitrary paid invoice. Main's invoice payment and reminder-cancellation behavior is preserved |
| Marketing thread ideas | Scoped read/flag contracts with stopped-contact exclusion and permission rules | No new cross-agent thread sharing is enabled |

Use `components/api.ts` in client adapters, with types in `lib/api`. Keep policy in `lib/domain` and provider calls, persistence and authorization in the server layers. Do not pass an ordinary server function as a callback across a server/client boundary. An attempted save is not a saved permission; preserve the previous value on failure and refresh other views after success.

## Routes and verification

Agent pages occupy `workflows/[workflow]/page.tsx`; nested automation pages remain `workflows/[workflow]/[automation]/page.tsx`. Each depth validates its own route token. No `[agent]` sibling or directory rename is needed. Approvals remains the only decision queue.

The combined working tree passed Node 26 `npm run check`: type checking, 1,567 automated tests across 131 files and the production build. Browser checks confirmed the license form, saved API facts, generated approval card and refreshed brief, with no sideways scrolling at 1440, 1024, 768 and 390px in the completed UI pass. The resumed pass rechecked Customer, Internal, Workflows, Approvals, Stack and Tools at 390px. The two new disclosures stay open when authoritative records refresh. Run Node 26 `npm run check` on the exact final tree before landing. Check desktop, narrow containers and phone layouts without sideways scrolling. The earlier handoff reports a real local phone test for `/start`, message, acknowledgment and approved reply; that is separate from automated coverage. The Supabase-backed deployed Telegram/brief flow, actual Postmark delivery and final scheduled execution still need controlled live checks. See [the demo runbook](../../../docs/agent-demo.md) for the current evidence and recording script. Fixture tests do not prove provider delivery.
