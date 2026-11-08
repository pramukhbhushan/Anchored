import type { CardRecord, CardStatus, ChatMessage, OutboxEntry } from "@/lib/api/contract";
import type { IntakeDraft } from "@/lib/domain/intake";
import type { BusinessProfile, Choice, ChoiceMap, KeyedCard, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The `Store` interface every persistence backend implements. Each call takes
// the visitor's session id, so one owner's choices and cards never reach another's.
// `SupabaseStore` is the production backend; `MemoryStore` runs without keys.

/** Fields of a card that a decision or a rewrite may change. */
export interface CardPatch {
  readonly status?: CardStatus;
  readonly body?: string;
  readonly edited?: boolean;
  readonly decidedAt?: string | null;
}

/** A new outbox entry before the store assigns its id. */
export type NewOutboxEntry = Omit<OutboxEntry, "id" | "sentAt"> & { readonly sentAt?: string };

/** A chat thread: one onboarding intake, or one business's ongoing chat. */
export interface ChatThread {
  readonly kind: "intake" | "business";
  readonly id: string;
}

/** A chat message before the store assigns its id and time. A reply's card is read from the cards, never stored on it. */
export type NewChatMessage = Omit<ChatMessage, "id" | "at" | "card">;

/** An onboarding chat: the draft so far and, once the owner confirms, the business it built. */
export interface IntakeRecord {
  readonly id: string;
  readonly draft: IntakeDraft;
  readonly businessId: string | null;
}

/** Persistence for businesses, choices, cards, the outbox, raw events and chats. */
export interface Store {
  readonly kind: "supabase" | "memory";
  /** Return the session's own businesses, oldest first. The example business lives in code and is not stored. */
  listBusinesses(session: string): Promise<BusinessProfile[]>;
  getBusiness(session: string, id: string): Promise<BusinessProfile | null>;
  saveBusiness(session: string, business: BusinessProfile): Promise<void>;
  getChoices(session: string, businessId: string): Promise<ChoiceMap>;
  setChoice(session: string, businessId: string, workflow: WorkflowId, choice: Choice): Promise<void>;
  /** Insert drafts whose key the session doesn't have yet. Existing cards keep their state. */
  ensureCards(session: string, businessId: string, drafts: readonly KeyedCard[]): Promise<void>;
  listCards(session: string, businessId: string): Promise<CardRecord[]>;
  getCard(session: string, cardId: string): Promise<CardRecord | null>;
  updateCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord>;
  /** Apply `patch` only while the card is still pending, and return it; `null` when another request decided it first. */
  updatePendingCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord | null>;
  addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry>;
  listOutbox(session: string, businessId: string): Promise<OutboxEntry[]>;
  recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
  /** Return the latest `limit` messages of a thread, oldest first. */
  listMessages(session: string, thread: ChatThread, limit: number): Promise<ChatMessage[]>;
  /** Append messages to a thread in order, and return them as stored. */
  addMessages(session: string, thread: ChatThread, messages: readonly NewChatMessage[]): Promise<ChatMessage[]>;
  getIntake(session: string, id: string): Promise<IntakeRecord | null>;
  saveIntake(session: string, intake: IntakeRecord): Promise<void>;
  /** Count one model call against the day's cap for every visitor together; `false` once the cap is reached. */
  useAiCall(day: string, cap: number): Promise<boolean>;
  /** Delete everything the session created, as "Delete my businesses" asks. */
  reset(session: string): Promise<void>;
}

/** Raised when a record the caller named does not exist in this session. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}
