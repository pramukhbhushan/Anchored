import type { ConnectionKind } from "@/lib/domain/connections";
import type { ConsentSource, Contact } from "@/lib/domain/contacts";
import type { IntakeQuestion, KnownFact, ProfileChange } from "@/lib/domain/intake";
import type { BusinessProfile, CardDraft, Choice, OnboardingAnswers, PlanApproval, SkillId, WorkflowId } from "@/lib/domain/types";

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

/** A card's decision state. `superseded` means a newer draft to the same customer replaced it before the owner decided. */
export type CardStatus = "pending" | "approved" | "skipped" | "superseded";

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

/**
 * Who sends an outbox entry and how far it got. `yours`: the owner sends it from their own apps. `queued`: Anchored
 * sends it at `sentAt`. `sending`: a send is under way. `sent` and `failed`: Anchored's send finished.
 */
export type Delivery = "yours" | "queued" | "sending" | "sent" | "failed";

/** One entry in the outbox. Anchored sends it through a connected service, or the owner sends it from their own apps. */
export interface OutboxEntry {
  readonly id: string;
  readonly businessId: string;
  readonly cardId: string;
  readonly channel: "sms" | "email" | "list";
  readonly to: string;
  readonly body: string;
  /** When it went out, or, while it is queued, when it may. */
  readonly sentAt: string;
  readonly delivery: Delivery;
  /** Why Anchored didn't send it, or what went wrong, in plain words; `null` when there is nothing to say. */
  readonly note: string | null;
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

/** POST /api/businesses/[id]/workflows: add a job the business doesn't have yet, and who handles it. */
export type AddJobRequest = { readonly workflow: WorkflowId; readonly path: "turnon" | "buy"; readonly toolId: string } | { readonly workflow: WorkflowId; readonly path: "build" };
export interface AddJobResponse {
  readonly workflow: WorkflowId;
  readonly choice: Choice;
}

/** PUT /api/businesses/[id]/plan: the owner says yes to the plan as it stands. */
export interface ApprovePlanRequest {
  readonly approved: true;
}
export interface ApprovePlanResponse {
  readonly planApproval: PlanApproval;
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

/** POST /api/businesses/[id]/invoice-sheet: an empty body asks to read the connected invoice sheet now. */
export type InvoiceSheetCheckRequest = Readonly<Record<string, never>>;

/** What reading the invoice sheet did, in the owner's words. */
export interface InvoiceSheetCheckResponse {
  readonly reply: string;
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
  /** The card this reply drafted, on business chat replies to a request for work. */
  readonly card?: ChatCardLink;
}

/** A card a business chat reply drafted, so the reply can link to it in Approvals. */
export interface ChatCardLink {
  /** The card's stable key, which names its place on the Approvals page. */
  readonly key: string;
  readonly title: string;
  readonly status: CardStatus;
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

/** POST /api/businesses/[id]/chat: tell Anchored what changed, or ask an agent for a draft. */
export interface BusinessChatRequest {
  readonly text: string;
}

/** GET and POST /api/businesses/[id]/chat. `changes` is what the latest message changed; empty on GET. */
export interface BusinessChatResponse {
  readonly messages: readonly ChatMessage[];
  readonly changes: readonly ProfileChange[];
}

// =============================================================================
// Connections and contacts
// =============================================================================

/** One service on the Connections page, without its secrets. */
export interface ConnectionView {
  readonly kind: ConnectionKind;
  readonly connected: boolean;
  /** What it is connected to: the texting number, the reply-to address or the forwarding address. */
  readonly detail: string | null;
  /** Addresses the owner pastes into the service's own settings, such as Twilio's webhook URLs. */
  readonly setup: readonly { readonly label: string; readonly value: string }[];
  /** Why this server can't offer the service, such as a missing email key, or `null` when it can. */
  readonly unavailable: string | null;
}

/** GET /api/businesses/[id]/connections. */
export interface ConnectionsResponse {
  /** Why this visitor can't connect services, such as being a guest, or `null` when they can. */
  readonly blocked: string | null;
  readonly connections: readonly ConnectionView[];
  readonly contacts: readonly Contact[];
}

/** PUT /api/businesses/[id]/connections: connect one service. */
export type ConnectRequest =
  | { readonly kind: "texting"; readonly accountSid: string; readonly authToken: string; readonly phone: string }
  | { readonly kind: "email-out"; readonly replyTo: string }
  | { readonly kind: "email-in" }
  | { readonly kind: "stripe"; readonly signingSecret: string };

/** POST /api/businesses/[id]/contacts: add a customer, or update one by `id`. */
export interface SaveContactRequest {
  readonly id?: string;
  readonly name: string;
  readonly phone?: string;
  readonly email?: string;
  /** Where their OK to get texts came from, or `null` for none. */
  readonly consent: ConsentSource | null;
}
