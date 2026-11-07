# Build contract

The exports each module of the Anchored app must provide. Three people build in parallel against this list, so the names and signatures are fixed. Types come from `lib/domain/types.ts` and `lib/api/contract.ts`.

The behavior spec is the published prototype at `mvp/anchored.html`. Port its logic and data; don't redesign it.

## Domain: pure TypeScript, no I/O (`lib/domain/`)

| Module | Exports |
| --- | --- |
| `workflows.ts` | `WORKFLOWS: Record<WorkflowId, { id; name; base }>`, `WORKFLOW_IDS: readonly WorkflowId[]`, `BASE_WORKFLOWS: readonly WorkflowId[]`, `PATH_LABEL: Record<PathKind, string>`, `PATH_DESCRIPTION: Record<PathKind, string>`, `SIGNALS: readonly { id: SignalId; label; short }[]`, `REACH_OPTIONS`, `TOOL_OPTIONS`, `LANGUAGE_OPTIONS` (string arrays) |
| `agents.ts` | `CORE_AGENTS: Record<CoreAgentId, CoreAgentDef>` (Front Desk, Follow-up, Bookkeeping and Invoicing, Content and Social, Internal Communications), `SKILLS: Record<SkillId, SkillDef>`, `WORKFLOW_SKILLS: Record<WorkflowId, readonly SkillId[]>`, `NICHE_TEMPLATES` (each with `slug`, `name`, `job`, `skills`, `workflow`, the `SignalId` that spawns it, and a `because` sentence), `spawnNicheAgents(signals): NicheAgent[]`, `MODEL_TIERS: Record<ModelTier, { model; why }>` |
| `catalog.ts` | `TOOLS: readonly Tool[]`, `DISCOVERY_QUEUE: readonly DiscoveryListing[]`, `toolById(id): Tool \| undefined`, `toolName(tool): string` |
| `rating.ts` | `CHECKS: readonly { key: CheckKey; label }[]`, `EVIDENCE_LABEL: Record<Evidence, string>`, `STATUS_LABEL: Record<CheckStatus, string>`, `usesSoftware(business, name): boolean`, `rateTool(tool, business): Rating` |
| `paths.ts` | `workflowIdsOf(business): WorkflowId[]`, `agentForSkill(business, skill): AgentRef` (a niche agent covering the skill's workflow wins, else the skill's core agent), `agentName(business, ref): string`, `pathOptions(business, workflow): PathOptions` (`build` names the agent and its skills, or is `null`), `defaultChoice(business, workflow): Choice`, `resolveChoices(business, saved: ChoiceMap): Record<WorkflowId, Choice>` (only the business's workflows), `chosenSkills(business, choices): SkillId[]`, `activeAgents(business, choices): ActiveAgent[]` (core agents with at least one chosen skill, Internal Communications always, then niche agents), `chosenTools(business, choices): { workflow; path: "turnon" \| "buy"; tool: Tool }[]`, `stackCost(business, choices): StackCost` (the $29 plan once any build skill is chosen) |
| `engine.ts` | `planWorkflows(facts: BusinessFacts): Partial<Record<WorkflowId, WorkflowPlan>>`, `profileFromFacts(facts, builtBy?): BusinessProfile` (includes `nicheAgents` from `spawnNicheAgents`), `profileFromAnswers(answers: OnboardingAnswers): BusinessProfile`, `profileFromSentence(text): BusinessProfile`, `detectTradeKey(text): TradeKey`, `TRADE_HINTS: Record<TradeKey, TradeHint>`, `hintFor(text): TradeHint`. Hints are suggestions the onboarding form shows for the owner to confirm. No function applies them on its own. |
| `cases.ts` | `CASE_STUDIES: readonly BusinessProfile[]` (ids `hvac`, `restaurant`, `coach`), built by `profileFromFacts` from each case's facts, then overlaid with researched `why`, `stake` and `isNew` text and researched cards. Paths come from the rules. An overlay may override a path only where the research gives a reason, and that reason is its `why`. Also `EXAMPLES: readonly (BusinessFacts & { id; label })[]`, `exampleProfile(id): BusinessProfile`, `caseStudyById(id): BusinessProfile \| undefined` |
| `cards.ts` | `CARD_TEMPLATES: Record<SkillId, (business, variant: number) => Omit<CardDraft, "agent" \| "skill">>`, `draftFeed(business, choices): KeyedCard[]` (one card per chosen skill, researched if present else template, stamped with `agentForSkill`; locked cards whose skill is chosen; one `triage` card from Internal Communications; key `${businessId}:${skill}` or `${businessId}:locked:${i}`), `simulateCard(business, choices, n): KeyedCard \| null` (rotates through chosen skills; key `${businessId}:sim:${n}`) |
| `executor.ts` | `checkSend(card: CardDraft, ctx: { now: Date; timeZone: string; hasConsent: boolean }): { ok: true } \| { ok: false; reason: string }` |
| `brief.ts` | `morningBrief(business, choices, cards: readonly { status; stake?; title }[]): string[]` |

## Server: data access (`lib/server/`)

| Module | Exports |
| --- | --- |
| `session.ts` | `getSessionId(): Promise<string>` reads the `anchored_session` cookie that `middleware.ts` sets |
| `data.ts` | `listBusinesses(): Promise<BusinessProfile[]>` (case studies, then the session's own), `getBusinessOrNotFound(id): Promise<BusinessProfile>`, `getChoices(business): Promise<Record<WorkflowId, Choice>>`, `getFeed(business): Promise<{ cards: CardRecord[]; outbox: OutboxEntry[] }>` |

## API routes (`app/api/`)

| Route | Method | Body | Returns |
| --- | --- | --- | --- |
| `/api/businesses` | POST | `CreateBusinessRequest` | `CreateBusinessResponse` |
| `/api/businesses/[id]/choices` | PUT | `SetChoiceRequest` | `SetChoiceResponse` |
| `/api/businesses/[id]/cards` | GET, POST | none, `SimulateRequest` | `CardsResponse` |
| `/api/cards/[id]` | POST | `DecideCardRequest` | `DecideCardResponse` |
| `/api/cards/[id]/rewrite` | POST | none | `RewriteResponse` |
| `/api/ingest/[source]` | POST | `IngestRequest` | `CardsResponse` |
| `/api/reset` | POST | none | `{ ok: true }` |

## Pages (`app/`)

`/` landing, `/onboard`, `/b/[id]` profile, `/b/[id]/workflows`, `/b/[id]/compare`, `/b/[id]/stack`, `/b/[id]/agents`, `/built`. Pages are server components that call `lib/server/data.ts` and the domain modules. Buttons are small client components that call the API routes, then `router.refresh()`.

Next.js 15: `params` in pages, layouts and route handlers is a `Promise`. Await it.

## v2: accounts, chat and the app shell

Three people build these in parallel. Each owns the files listed for them and nothing else.

### Accounts (owner: accounts)

- Supabase Auth through `@supabase/ssr`. Sign-in by emailed magic link and by Google, plus **Continue as guest**, which uses Supabase anonymous sign-in so judges can test without an account. A guest can later save their work by adding an email.
- Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, for auth in the browser), `SUPABASE_SERVICE_ROLE_KEY` (server only, for the store). `SUPABASE_URL` stays accepted as a fallback for the store.
- With no Supabase settings, accounts are off, the anonymous cookie session keeps working, and the app shows a small "Local demo mode" note.
- `lib/auth/`: `isAuthEnabled()`, `createServerSupabase()`, `createBrowserSupabase()`.
- `lib/server/session.ts`: `getSessionId()` keeps its signature. It returns the verified Supabase user id when accounts are on, otherwise the cookie session (validated as a UUID). New `getViewer(): Promise<Viewer>` with `{ id, email: string | null, isGuest: boolean, authEnabled: boolean }`.
- Pages: `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`.
- `middleware.ts`: refresh the Supabase session; when accounts are on, send visitors to `/app/*` without a user to `/login?next=...`. Keep every existing API guard and test.
- `components/account/AccountMenu.tsx`: client component taking a `Viewer`. Shows the email or "Guest", "Save your work" for guests, and "Sign out".
- `supabase/migrations/20261107000200_auth_policies.sql`: RLS policies so a signed-in user can reach only rows whose `session_id` is their `auth.uid()`, as defense in depth beside the server's service-role store.

### Chat (owner: chat)

- `lib/domain/intake.ts` (pure): the facts onboarding needs, the next question for a draft (with chip options from `REACH_OPTIONS`, `TOOL_OPTIONS`, `SIGNALS`, `LANGUAGE_OPTIONS` and `hintFor`), rule-based parsing of an answer, `isComplete`, and `draftToAnswers(draft): OnboardingAnswers`.
- `lib/server/intake-ai.ts` and `lib/server/business-chat.ts`: when an AI provider is configured, the model reads the conversation, extracts facts (only allowed option values survive validation) and writes the next question. Without AI, or on any AI error, the rules run instead.
- Store: chat threads and intake drafts added to `Store`, `MemoryStore`, `SupabaseStore`, with `supabase/migrations/20261107000300_chat.sql`.
- API: `POST /api/intake` starts an intake and returns `{ intakeId, messages, question }`. `POST /api/intake/[id]` takes `{ text?, picks? }` and returns `{ messages, known, question, done, businessId? }`; when done it creates the business the same way `POST /api/businesses` does. `GET` and `POST /api/businesses/[id]/chat` (`{ text }`) return `{ messages, changes }`. Telling Anchored something new can add or remove workflows. Case studies are read-only in chat.
- `components/chat/ChatWindow.tsx`: client component. Props `{ mode: "intake" }` or `{ mode: "business", businessId: string, readOnly?: boolean }`. Bubbles, a typing indicator, quick-reply chips (multi-select with a Done chip), a text box, and a live "What Anchored knows" summary for intake, ending in an "Open your plan" button.

### App shell (owner: shell)

- The product lives under `/app`: `/app` (your businesses and the case studies), `/app/new` (chat onboarding with `ChatWindow`), and `/app/b/[id]` (overview), `/workflows`, `/tools`, `/approvals`, `/stack`, `/profile`, `/chat`.
- The shell has a sidebar with icons from `lucide-react`, a top bar with the business switcher and `AccountMenu`, and a drawer at phone width. Every route gets `loading.tsx` and `error.tsx`, and there is a `not-found.tsx`.
- Old routes `/onboard` and `/b/[id]/*` redirect to their new homes. `/` stays the marketing page, with sign-in and "Try it" calls to action.
- The shell mounts `ChatWindow` and `AccountMenu` by the props above. It doesn't build its own chat or auth.
