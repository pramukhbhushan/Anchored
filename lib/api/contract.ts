import type { BusinessProfile, CardDraft, Choice, OnboardingAnswers, SkillId, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Request and response shapes for Anchored's API routes. The pages call these
// routes with `fetch`; ingest webhooks use the same `/api/ingest/*` path. Every
// route reads the anonymous demo session from the `anchored_session` cookie.

// =============================================================================
// Stored records
// =============================================================================

export type CardStatus = "pending" | "approved" | "skipped";

/** A card as stored: the draft plus its decision state. */
export interface CardRecord extends CardDraft {
  readonly id: string;
  readonly key: string;
  readonly businessId: string;
  readonly status: CardStatus;
  readonly edited: boolean;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

/** One entry in the simulated outbox. Nothing is really sent in the demo. */
export interface OutboxEntry {
  readonly id: string;
  readonly businessId: string;
  readonly cardId: string;
  readonly channel: "sms" | "email" | "list";
  readonly to: string;
  readonly body: string;
  readonly sentAt: string;
}

// =============================================================================
// Routes
// =============================================================================

/** POST /api/businesses: build a profile from onboarding answers, an example, or one sentence. */
export type CreateBusinessRequest =
  | { readonly from: "answers"; readonly answers: OnboardingAnswers }
  | { readonly from: "example"; readonly exampleId: string }
  | { readonly from: "sentence"; readonly sentence: string };
export interface CreateBusinessResponse {
  readonly id: string;
  readonly business: BusinessProfile;
}

/** PUT /api/businesses/[id]/choices: pick a path for one workflow. */
export type SetChoiceRequest = { readonly workflow: WorkflowId; readonly path: "turnon" | "buy"; readonly toolId: string } | { readonly workflow: WorkflowId; readonly path: "build" | "skip" };
export interface SetChoiceResponse {
  readonly choice: Choice;
}

/** GET /api/businesses/[id]/cards returns the feed; POST simulates a new event for a chosen skill. */
export interface CardsResponse {
  readonly cards: readonly CardRecord[];
  readonly outbox: readonly OutboxEntry[];
  /** The card a simulate or ingest request just created, when it made one. */
  readonly added?: CardRecord | null;
}
export interface SimulateRequest {
  readonly skill?: SkillId;
}

/** POST /api/cards/[id]: approve, approve an edited body, or skip. */
export type DecideCardRequest = { readonly decision: "approve"; readonly body?: string } | { readonly decision: "skip" };
export interface DecideCardResponse {
  readonly card: CardRecord;
  /** Set when the executor refused to send, with the rule that stopped it. */
  readonly blocked?: string;
  readonly outbox?: OutboxEntry;
}

/** POST /api/cards/[id]/rewrite: redraft the body in the owner's voice with Claude. */
export interface RewriteResponse {
  readonly card: CardRecord;
}

/** POST /api/ingest/[source]: an outside event, such as a missed call or a lead form, becomes a card. */
export interface IngestRequest {
  readonly businessId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Error body every route returns on failure. */
export interface ApiError {
  readonly error: string;
}
