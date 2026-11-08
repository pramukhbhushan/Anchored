# Anchored: Agent System Handoff

UMD Smith AI for Small Business Hack-a-thon. Build weekend Nov 6-8, 2026. Deliverables (10-minute video and testable prototype link) are due today, Sunday Nov 8, 2026.

## Situation

- **Team:** Eric (ericweisong@gmail.com) and Pramukh.
- **Product:** Anchored recommends AI workflows to small businesses and runs agents for them.
- **Repo:** `pramukhbhushan/Anchored`, `origin/main`, as of PR #40. Next.js 15 (App Router), TypeScript, Supabase, Vercel, Zod.
- **Repo access:** The GitHub connector failed in this session. Eric's local copy is `~/Anchored`, on branch `eric-design-testing`, 98 commits behind main. The reliable way in was the device bridge: request folder access, then run `git archive origin/main` into a scratch folder. Treat the repo as read-only unless Eric asks for code.

## What exists

The main deliverable is the Claude Doc **Anchored Agent System Design** (https://claude.ai/artifact/WPrpf7uKkPq857eXKzsr44, doc id `ee0a1678-a8bf-471c-86ae-22d028a53835`). It follows Eric's `system.md` C4 template and is complete (13 sections): scope, business and security posture, shared design (character fields, shared loop, coordination), the four agents, C4 context, container and deployment views, risk assessment, and questions and assumptions.

Related docs:

- **Anchored: Agents and Dashboard Direction** (`7f66c02f-eb90-4ec4-9e9b-76c74e78a4e3`): the concise doc for Eric and Pramukh. It holds the decisions, the Telegram flow, the sidebar tree and a 13-row code-changes table whose Owner column is still empty.
- **Anchored Agent Specs** (`902d364f-5f5d-42df-8619-c711096e5bb5`): outdated. It assumes Twilio, five agents and Gmail triage. Do not build from it. Retire or fix it only if Eric asks.

## Settled decisions (do not relitigate)

1. **Telegram replaces Twilio for all customer messages.**
   - One shared Anchored bot, with a per-business deep link `t.me/<bot>?start=<telegram_hook_id>` and a QR code.
   - Guests can see the link, labeled as a test link.
   - Webhook is `/api/hooks/telegram`. It checks `X-Telegram-Bot-Api-Secret-Token` and dedupes by `update_id`.
   - `/start` binds the chat to the business. `/stop` and `my_chat_member` (blocked) add the contact to the STOP list.
   - The bot sends plain text and inline URL buttons. It can use `deleteMessage` within 48 hours.
   - The opt-out line is required for SMS only. Quiet hours and the allergy lock apply to all channels.
2. **Four agents:** Customer (front desk and follow-up merged, one thread per contact), Bookkeeping, Marketing, Internal Communications. The repo currently has `CoreAgentId = frontdesk|followup|books|content|internal`, so frontdesk and followup need merging into `customer`. The 19 existing SkillIds map onto the four agents.
3. **The owner always has final say.** Standing rules are approved once by the owner. v1 offers only the acknowledgment rule (a fixed template). Everything else is an Approvals card. Approvals stays the single queue.
4. **Missed calls are simulator-only** for the demo.
5. **Dashboard:**
   - Each active agent gets its own page under Workflows in the sidebar. The label stays "Workflows".
   - Each agent page has an Ask box that reuses the chat component, plus its info.
   - Top-level Chat stays as the general entry.
   - Route: `app/app/b/[id]/workflows/[agent]/page.tsx`. It relies on `agentHref` in `routes.ts`, `shell-data.ts`, `Sidebar.tsx`, `CommandPalette.tsx` and `activeAgents()` in `lib/domain/paths.ts`.
6. Forwarded customer emails stay one-off cards. Triage hands them to the Customer agent as a card.
7. **Scope:** Eric believes everything can be finished in a day and dismissed the scope concern. Do not push back on it again.

## Invariants to preserve

- **"The model writes text, and code decides."**
- `checkSend` gates every send, both at approval and again at dispatch. It refuses a locked thread, an allergy answer, an unfilled `[placeholder]`, a missing opt-out line or consent, and quiet hours (`OWNER_TIME_ZONE`).
- `decideCard` is the only caller of `Store.addOutbox`.
- Every Store method filters by session id. Migrations are append-only.
- `contract.ts` and `schemas.ts` agree via `satisfies`. `lib/architecture.test.ts` enforces the layer boundaries.

## Planned code work (nothing implemented yet)

- **Types and migration:** a Telegram channel plus contact chat id, with a migration. New tables and columns: `thread_messages`, `businesses.telegram_hook_id`, `businesses.standing_rules`, `cards.parent_key`.
- **Connector and webhook:** `lib/connectors/telegram.ts`, `app/api/hooks/telegram/route.ts`, `lib/server/hooks.ts`, and a hook id in `create-business.ts`.
- **Store:** thread methods in `types.ts`, `memory.ts` and `supabase.ts`.
- **Ingest:** a `telegram` source in `ingest.ts`.
- **Customer reply:** `lib/server/customer-reply.ts`.
  - Code picks the skill from thread state: open quote means Closer, booking means Show-up Keeper, catering means Catering Responder, otherwise Inquiry.
  - The model writes the reply from the profile plus the last 10 messages, with customer text marked as data.
  - Code rejects any price, time, link or number not found in the profile or thread. This is the same check as `rewriteInVoice`. A template reply is the fallback.
- **Delivery and rules:** make the opt-out line SMS-only in `executor.ts`, add a Telegram branch in `dispatch.ts` / `deliveryFor`, and add the acknowledgment rule in `plan.ts` / `BusinessProfile`.
- **Dashboard:** the agent pages above.
- **Env vars:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`.
- **Docs and demo:** rewrite the README texting section and seed demo data in `cases.ts`.

## Deferred (do not build)

SMS and phone, real voice and missed calls, joining email into Telegram threads, per-business bot tokens, and Google Business Profile or Meta publishing.

## Working notes

- **Claude Docs:** send multi-block replaces with `ifRev` only, since adding `ifHash` was refused. Doc comments do not reach the session automatically. When Eric forwards one, reply in-thread by creating an utterance under the root comment id. Load tool schemas via ToolSearch first.
- **Stray files:** Eric's `~/Anchored` has untracked `DESIGN.md` and `REMEDIATION.md` written before repo access. Advise against committing them.
- **Eric's style:** concise answers, honest critique, quick decisions. Do only what he explicitly asks.
- **Open ask:** none. The design doc is done. Wait for Eric's next instruction, likely "start implementing" or doc edits.
