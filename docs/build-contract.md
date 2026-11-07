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
