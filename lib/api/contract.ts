import type { IntakeQuestion, KnownFact, ProfileChange } from "@/lib/domain/intake";
import type { BusinessProfile, CardDraft, Choice, OnboardingAnswers, SkillId, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Request and response shapes for Anchored's API routes. The pages call these
// routes with `fetch`; ingest webhooks use the same `/api/ingest/*` path. Every
// route reads the visitor from their Supabase session, or from the anonymous
// `anchored_session` cookie when accounts are off.

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

/** One entry in the outbox. Anchored isn't connected to texting or email yet, so the owner sends each one from their own apps. */
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

/** DELETE /api/businesses: everything the visitor saved is gone. */
export interface DeleteBusinessesResponse {
  readonly ok: true;
}

/** PUT /api/businesses/[id]/choices: pick a path for one workflow. */
export type SetChoiceRequest = { readonly workflow: WorkflowId; readonly path: "turnon" | "buy"; readonly toolId: string } | { readonly workflow: WorkflowId; readonly path: "build" | "skip" };
export interface SetChoiceResponse {
  readonly choice: Choice;
}

/** GET /api/businesses/[id]/cards: the card feed and the outbox. */
export interface CardsResponse {
  readonly cards: readonly CardRecord[];
  readonly outbox: readonly OutboxEntry[];
}

/** POST /api/businesses/[id]/cards: try an example event on the example business, for one chosen skill or rotating through them all. */
export interface SimulateRequest {
  readonly skill?: SkillId;
}

/** POST /api/businesses/[id]/cards and POST /api/ingest/[source]: the feed, plus the card the event created. */
export interface EventCardResponse extends CardsResponse {
  /** The new card, or `null` when the store could not read it back. */
  readonly added: CardRecord | null;
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

// =============================================================================
// Chat: onboarding by conversation, and the ongoing business chat
// =============================================================================

/** One message in a chat thread. */
export interface ChatMessage {
  readonly id: string;
  readonly role: "anchored" | "owner";
  readonly text: string;
  /** ISO time the message was stored. */
  readonly at: string;
  /** What this reply changed in the business, on business chat replies that changed something. */
  readonly changes?: readonly ProfileChange[];
}

/** The state of an onboarding chat, as every intake route returns it. */
export interface IntakeResponse {
  readonly messages: readonly ChatMessage[];
  /** One line per question for the "What Anchored knows" card. */
  readonly known: readonly KnownFact[];
  /** What Anchored asks next, or `null` once the owner confirmed and the business exists. */
  readonly question: IntakeQuestion | null;
  readonly done: boolean;
  /** Set once the business is built. Its plan lives at `/app/b/<businessId>`. */
  readonly businessId?: string;
}

/** POST /api/intake: start an onboarding chat. */
export interface StartIntakeResponse extends IntakeResponse {
  readonly intakeId: string;
}

/** POST /api/intake/[id]: answer the current question by typing, tapping chips, or both. GET returns the same state. */
export interface IntakeAnswerRequest {
  readonly text?: string;
  /** The full selection for a multi-select question, or the one chip tapped on a single-select one. */
  readonly picks?: readonly string[];
}

/** POST /api/businesses/[id]/chat: tell Anchored what changed. */
export interface BusinessChatRequest {
  readonly text: string;
}

/** GET and POST /api/businesses/[id]/chat. `changes` is what the latest message changed; empty on GET. */
export interface BusinessChatResponse {
  readonly messages: readonly ChatMessage[];
  readonly changes: readonly ProfileChange[];
}
