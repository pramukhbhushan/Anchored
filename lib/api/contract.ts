import type { FollowupInput, RecordedFollowup } from "@/lib/domain/followups";
import type { License } from "@/lib/domain/renewals";
import type { AiProviderId, ServiceKind } from "@/lib/domain/connections";
import type { ConsentSource, Contact } from "@/lib/domain/contacts";
import type { IntakeQuestion, KnownFact, ProfileChange } from "@/lib/domain/intake";
import type { BriefSnapshot } from "@/lib/domain/brief";
import type { OutboxRule } from "@/lib/domain/rules";
import type { BusinessProfile, CardDraft, Choice, OnboardingAnswers, PlanApproval, SkillId, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Request and response shapes for Anchored's API routes, which the pages call
// with `fetch`. Provider webhooks under `/api/hooks/` take each provider's own
// format instead. Every route reads the visitor from their Supabase session, or
// from the anonymous `anchored_session` cookie when accounts are off.

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
  /** The card the owner approved; `null` for an entry a standing rule or a protocol notice authorized instead. */
  readonly cardId: string | null;
  readonly channel: "sms" | "email" | "telegram" | "list";
  readonly to: string;
  readonly body: string;
  /** When it went out, or, while it is queued, when it may. */
  readonly sentAt: string;
  readonly delivery: Delivery;
  /** Why Anchored didn't send it, or what went wrong, in plain words; `null` when there is nothing to say. */
  readonly note: string | null;
  /** What authorized it when no card tap did: the owner's standing rule, or the bot's fixed answer to /start or /stop. */
  readonly rule?: OutboxRule;
  /** The contact a Telegram entry goes to. `to` holds their name for the owner to read; the chat id stays server side. */
  readonly contactId?: string;
  /** Provider identity for server-side operations. Never accepted from deletion request input. */
  readonly providerId?: string;
  readonly deletionState?: "deleting" | "deleted" | "failed";
  readonly deletionNote?: string;
  /** Computed by the server at read time, then checked again on the delete request. */
  readonly canDeleteTelegram?: boolean;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET and POST /api/businesses/[id]/brief: the last finished daily brief, as plain lines and the counts behind them.
 * POST runs a new one now ("Run now"). Every number comes from code; `lastRunAt` is `null` before the first brief.
 */
export interface BriefResponse {
  readonly lines: readonly string[];
  readonly snapshot: BriefSnapshot | null;
  readonly lastRunAt: string | null;
  /** The brief's card in Approvals, for a link. */
  readonly cardKey: string | null;
  /** Another run is under way, so this one didn't start; the lines are the last finished brief. */
  readonly running: boolean;
  readonly unavailableReason: string | null;
}

/** The acknowledgment rule as the owner sees it: on or off, and when they last approved it. */
export interface AcknowledgmentState {
  readonly enabled: boolean;
  readonly approvedAt: string | null;
}

/**
 * GET and PUT /api/businesses/[id]/standing-rules: the acknowledgment rule's saved state, the exact text it sends, and
 * why it can't change, when it can't. A PUT answers with the state as saved, never the state the owner asked for.
 */
export interface StandingRulesResponse {
  readonly acknowledge: AcknowledgmentState;
  readonly template: string;
  readonly unavailableReason: string | null;
}

/** PUT /api/businesses/[id]/standing-rules: turn the acknowledgment rule on or off. */
export interface SetStandingRuleRequest {
  readonly enabled: boolean;
}

/** One customer in the Customer agent's list, newest conversation first. */
export interface CustomerSummary {
  readonly id: string;
  readonly name: string;
  readonly lastText?: string;
  readonly lastAt?: string;
  /** The customer sent /stop or blocked the bot. */
  readonly stopped: boolean;
  /** An allergy question of theirs waits for the owner's own answer. */
  readonly locked: boolean;
}

/** One message in a customer's thread, with what happened to it when Anchored sent it. */
export interface ThreadMessageView {
  readonly id: string;
  readonly direction: "in" | "out";
  readonly text: string;
  readonly at: string;
  readonly skill?: string;
  readonly cardKey?: string;
  readonly delivery?: "queued" | "sending" | "sent" | "failed";
  readonly note?: string;
  /** Set when a rule sent it with no card: the owner's acknowledgment rule or the bot's answer to /start or /stop. */
  readonly rule?: OutboxRule;
}

/**
 * GET /api/businesses/[id]/customers?contact=<id>: the business's Telegram customers and one customer's thread,
 * oldest message first. `selectedContactId` is `null` when there are none or the asked-for one isn't this business's.
 */
export interface CustomersResponse {
  readonly contacts: readonly CustomerSummary[];
  readonly selectedContactId: string | null;
  readonly messages: readonly ThreadMessageView[];
  readonly unavailableReason?: string;
}

/**
 * GET /api/businesses/[id]/telegram: the link customers open to message this business through the shared bot, or
 * the reason there is none. Exactly one of the two is set. The bot's token never appears here.
 */
export interface TelegramSetupResponse {
  readonly url: string | null;
  readonly unavailableReason: string | null;
}

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

/** PUT /api/businesses/[id]/automations: turn one job's automation on or off from the Automations page. */
export interface SetAutomationRequest {
  readonly workflow: WorkflowId;
  readonly on: boolean;
}
export interface SetAutomationResponse {
  readonly choice: Choice;
  /** True when turning it on put Anchored's first question for it in the business chat. */
  readonly asked: boolean;
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

/** What `POST /api/businesses/[id]/photos` returns for one uploaded photo. */
export interface PhotoUploadResponse {
  readonly photo: { readonly id: string; readonly url: string };
}

/** POST /api/businesses/[id]/chat: tell Anchored what changed, or ask an agent for a draft. */
export interface BusinessChatRequest {
  readonly text: string;
  /** Ids of photos the owner uploaded for a post, in the order they picked them. */
  readonly photos?: readonly string[];
  readonly agent?: string;
}

/** GET and POST /api/businesses/[id]/chat. `changes` is what the latest message changed; empty on GET. */
export interface BusinessChatResponse {
  readonly messages: readonly ChatMessage[];
  readonly changes: readonly ProfileChange[];
  /** Set when Anchored didn't act on the message, such as photos sent before post drafts are on: the chat puts the words and photos back in the text box. */
  readonly keepComposer?: true;
}

// =============================================================================
// Connections and contacts
// =============================================================================

/** One service on the Connections page, without its secrets. */
export interface ConnectionView {
  readonly kind: ServiceKind;
  readonly connected: boolean;
  /** What it is connected to: the texting number, the reply-to address or the forwarding address. */
  readonly detail: string | null;
  /** Addresses the owner pastes into the service's own settings, such as Twilio's webhook URLs. */
  readonly setup: readonly { readonly label: string; readonly value: string }[];
  /** Why this server can't offer the service, such as a missing email key, or `null` when it can. */
  readonly unavailable: string | null;
}

/** The business's own AI key on the Connections page, without the key itself. */
export interface AiKeyView {
  /** The provider the saved key is for, or `null` when the business has no key. */
  readonly provider: AiProviderId | null;
  /** The saved key's last four characters, so the owner can tell keys apart. */
  readonly lastFour: string | null;
  /** The model the owner named, or `null` for the provider's own choice. */
  readonly model: string | null;
  /** Who writes drafts while the business has no key: this server's own AI, or Anchored's rules. */
  readonly fallback: "server" | "rules";
  /** Why this server can't keep AI keys, or `null` when it can. */
  readonly unavailable: string | null;
}

/** GET /api/businesses/[id]/connections. */
export interface ConnectionsResponse {
  /** Why this visitor can't connect services, such as being a guest, or `null` when they can. */
  readonly blocked: string | null;
  readonly ai: AiKeyView;
  readonly connections: readonly ConnectionView[];
  readonly contacts: readonly Contact[];
}

/** PUT /api/businesses/[id]/connections: connect one service. */
export type ConnectRequest =
  | { readonly kind: "texting"; readonly accountSid: string; readonly authToken: string; readonly phone: string; readonly forwardTo?: string }
  | {
      readonly kind: "email-out";
      readonly replyTo: string;
      /** The owner's own Resend API key. */
      readonly apiKey: string;
      /** The address emails come from, on a domain verified in the owner's Resend account. */
      readonly fromAddress: string;
    }
  | { readonly kind: "email-in" }
  | { readonly kind: "stripe"; readonly signingSecret: string };

/** PUT /api/businesses/[id]/ai-key: check the owner's own AI key with one short call, then save it. */
export interface SaveAiKeyRequest {
  readonly provider: AiProviderId;
  readonly apiKey: string;
  /** The model to run, as the provider names it. Only Anthropic picks one when it is left out. */
  readonly model?: string;
}

/** POST /api/businesses/[id]/contacts: add a customer, or update one by `id`. */
export interface SaveContactRequest {
  readonly id?: string;
  readonly name: string;
  readonly phone?: string;
  readonly email?: string;
  /** Where their OK to get texts came from, or `null` for none. */
  readonly consent: ConsentSource | null;
}

/** POST /api/businesses/[id]/outbox/[entry]/delete: confirm removal from Telegram, preserving the audit record. */
export interface DeleteTelegramRequest { readonly confirm: true }
export interface DeleteTelegramResponse { readonly deleted: boolean; readonly message: string }

/** Owner-entered future work, not permission to send. */
export type ScheduleFollowupRequest = FollowupInput;
export interface CancelFollowupRequest { readonly id: string }
export interface FollowupsResponse { readonly records: readonly RecordedFollowup[] }
export interface SaveLicensesRequest { readonly licenses: readonly License[] }
export interface LicensesResponse { readonly licenses: readonly License[] }
