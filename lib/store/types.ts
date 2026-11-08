import type { CardRecord, CardStatus, ChatMessage, OutboxEntry } from "@/lib/api/contract";
import type { IntakeDraft } from "@/lib/domain/intake";
import type { BusinessProfile, Choice, ChoiceMap, ConversationOwner, KeyedCard, ProfileChangeSource, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The `Store` interface every persistence backend implements. Each call takes
// the visitor's session id, so one owner's choices and cards never reach another's.
// `SupabaseStore` is the production backend; `MemoryStore` runs without keys.
// Three lookups serve the Telegram webhook and the delivery job, which have no
// visitor session: `resolveChannelLink`, `findConversation` and `listUndelivered`.

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

/** A chat message before the store assigns its id and time. */
export type NewChatMessage = Omit<ChatMessage, "id" | "at">;

/** An onboarding chat: the draft so far and, once the owner confirms, the business it built. */
export interface IntakeRecord {
  readonly id: string;
  readonly draft: IntakeDraft;
  readonly businessId: string | null;
}

/** One saved copy of a business profile. */
export interface ProfileVersion {
  readonly version: number;
  readonly changedBy: ProfileChangeSource;
  readonly savedAt: string;
  readonly snapshot: BusinessProfile;
}

/** Channels a customer can reach a business on through Anchored itself. */
export type ConversationChannel = "telegram";

/** One customer's conversation with a business on a channel, and the agent that owns it. */
export interface Conversation {
  readonly channel: ConversationChannel;
  /** The customer's key on the channel, such as a Telegram chat id. One chat talks to one business at a time. */
  readonly contact: string;
  readonly businessId: string;
  /** The customer's name as the channel gives it. */
  readonly displayName: string;
  readonly owner: ConversationOwner;
  readonly optedOut: boolean;
  readonly updatedAt: string;
}

/** Fields of a conversation that a later message may change. */
export interface ConversationPatch {
  readonly displayName?: string;
  readonly owner?: ConversationOwner;
  readonly optedOut?: boolean;
}

/** What happened when Anchored handed an outbox entry to its channel. */
export type DeliveryResult = { readonly deliveredAt: string } | { readonly error: string };

/** A record found by a deployment-wide lookup, with the session it belongs to, so later calls stay session-scoped. */
export interface Owned<T> {
  readonly session: string;
  readonly value: T;
}

/** Persistence for businesses, choices, cards, the outbox, raw events and chats. */
export interface Store {
  readonly kind: "supabase" | "memory";
  /** Return the session's own businesses, oldest first. The example business lives in code and is not stored. */
  listBusinesses(session: string): Promise<BusinessProfile[]>;
  getBusiness(session: string, id: string): Promise<BusinessProfile | null>;
  /** Save `business`, bump its `version`, keep a copy in its history, and return it as saved. */
  saveBusiness(session: string, business: BusinessProfile, changedBy?: ProfileChangeSource): Promise<BusinessProfile>;
  /** Return a business's saved versions, newest first. */
  listProfileVersions(session: string, businessId: string): Promise<ProfileVersion[]>;
  getChoices(session: string, businessId: string): Promise<ChoiceMap>;
  setChoice(session: string, businessId: string, workflow: WorkflowId, choice: Choice): Promise<void>;
  /** Insert drafts whose key the session doesn't have yet. Existing cards keep their state. */
  ensureCards(session: string, businessId: string, drafts: readonly KeyedCard[]): Promise<void>;
  listCards(session: string, businessId: string): Promise<CardRecord[]>;
  getCard(session: string, cardId: string): Promise<CardRecord | null>;
  updateCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord>;
  /** Apply `patch` only while the card is still pending, and return it; `null` when another request decided it first. */
  updatePendingCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord | null>;
  /** Mark every pending card to `contact` as `superseded`, except the one keyed `exceptKey`, and return how many changed. */
  supersedePendingCards(session: string, businessId: string, contact: string, exceptKey: string): Promise<number>;
  addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry>;
  listOutbox(session: string, businessId: string): Promise<OutboxEntry[]>;
  /** Record whether the channel took an outbox entry. */
  markDelivered(session: string, outboxId: string, result: DeliveryResult): Promise<void>;
  /** Return the code customers use to reach a business on `channel`, creating it on first use. */
  ensureChannelLink(session: string, businessId: string, channel: ConversationChannel): Promise<string>;
  getConversation(session: string, channel: ConversationChannel, contact: string): Promise<Conversation | null>;
  /** Bind a customer's chat to a business in this session, replacing any earlier binding of that chat. */
  bindConversation(session: string, conversation: Conversation): Promise<void>;
  /** Apply `patch` to this session's conversation, and return it; `null` when the chat isn't bound here. */
  updateConversation(session: string, channel: ConversationChannel, contact: string, patch: ConversationPatch): Promise<Conversation | null>;
  recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
  /** Return the latest `limit` messages of a thread, oldest first. */
  listMessages(session: string, thread: ChatThread, limit: number): Promise<ChatMessage[]>;
  /** Append messages to a thread in order, and return them as stored. */
  addMessages(session: string, thread: ChatThread, messages: readonly NewChatMessage[]): Promise<ChatMessage[]>;
  getIntake(session: string, id: string): Promise<IntakeRecord | null>;
  saveIntake(session: string, intake: IntakeRecord): Promise<void>;
  /** Count one model call against the day's cap for every visitor together; `false` once the cap is reached. */
  useAiCall(day: string, cap: number): Promise<boolean>;
  /** Deployment-wide, for the Telegram webhook only: the business a link code opens, or `null`. */
  resolveChannelLink(code: string): Promise<Owned<{ readonly businessId: string; readonly channel: ConversationChannel }> | null>;
  /** Deployment-wide, for the Telegram webhook only: the conversation a chat is bound to, or `null`. */
  findConversation(channel: ConversationChannel, contact: string): Promise<Owned<Conversation> | null>;
  /** Deployment-wide, for the delivery job only: Telegram entries due by `now` that the channel hasn't taken or refused. */
  listUndelivered(now: Date, limit: number): Promise<Owned<OutboxEntry>[]>;
  /** Delete everything the session created, as "Delete my businesses" asks. */
  reset(session: string): Promise<void>;
}

/** Raised when a record the caller named does not exist in this session. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}
