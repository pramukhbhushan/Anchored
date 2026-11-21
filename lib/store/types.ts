import type { RecordedFollowup } from "@/lib/domain/followups";
import type { CardRecord, CardStatus, ChatMessage, Delivery, OutboxEntry } from "@/lib/api/contract";
import type { ConnectionKind } from "@/lib/domain/connections";
import type { Contact } from "@/lib/domain/contacts";
import type { IntakeDraft } from "@/lib/domain/intake";
import type { PostPlaybook } from "@/lib/domain/playbook";
import type { BriefSnapshot } from "@/lib/domain/brief";
import type { OutboxRule, StandingRuleId, StandingRuleState } from "@/lib/domain/rules";
import type { NewThreadMessage, ThreadMessage } from "@/lib/domain/threads";
import type { BusinessProfile, Choice, ChoiceMap, ConversationOwner, KeyedCard, ProfileChangeSource, TradeKey, WorkflowId } from "@/lib/domain/types";

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

/** A new outbox entry before the store assigns its id. It is the owner's to send unless `delivery` says otherwise. */
export type NewOutboxEntry = Omit<OutboxEntry, "id" | "sentAt" | "delivery" | "note"> & {
  readonly sentAt?: string;
  readonly delivery?: Delivery;
  readonly note?: string | null;
};

/** What a finished or failed send changes on an outbox entry. */
export interface OutboxPatch {
  readonly delivery: Delivery;
  readonly note?: string | null;
  /** The provider's id for the message, such as Twilio's `SM...` sid. */
  readonly providerId?: string;
  readonly deletionState?: "deleting" | "deleted" | "failed";
  readonly deletionNote?: string;
  /** When it actually went out. */
  readonly sentAt?: string;
}

/** A connected service as stored. `secret` is encrypted by `lib/server/secrets.ts` before it reaches the store. */
export interface StoredConnection {
  readonly id: string;
  readonly businessId: string;
  readonly kind: ConnectionKind;
  /** A random id that names this connection in webhook URLs and the forwarding address. Unique across every session. */
  readonly hookId: string;
  /** Settings safe to show, such as the texting number or the reply-to address. */
  readonly settings: Readonly<Record<string, string>>;
  readonly secret: string | null;
  readonly createdAt: string;
}

/** A connection before the store assigns its id and time. */
export type NewConnection = Omit<StoredConnection, "id" | "createdAt">;

/** A contact before the store assigns its id; with `id` set, it replaces that contact. */
export type NewContact = Omit<Contact, "id"> & { readonly id?: string };

/** A photo an owner uploaded for a post, without its bytes. */
export interface StoredPhoto {
  readonly id: string;
  readonly businessId: string;
  readonly contentType: string;
  readonly size: number;
}

/** A photo's bytes and type, as `getPhoto` returns them. */
export interface PhotoFile {
  readonly contentType: string;
  readonly data: Uint8Array;
}

/** A chat thread: one onboarding intake, or one business's ongoing chat. */
export interface ChatThread {
  readonly kind: "intake" | "business";
  readonly id: string;
}

/** A chat message before the store assigns its id and time. A reply's card is read from the cards, never stored on it. */
export type NewChatMessage = Omit<ChatMessage, "id" | "at" | "card">;

/** Which business a Telegram chat is talking to: the one whose link the customer opened last, with the owning session. */
export interface TelegramChat {
  readonly chatId: string;
  readonly session: string;
  readonly businessId: string;
  readonly contactId: string;
  readonly boundAt: string;
  /** When the customer blocked the bot, or `null`. Blocking stops every business on the shared bot. */
  readonly blockedAt: string | null;
}

/** A Telegram chat binding before it is saved. The session comes from the caller. */
export type NewTelegramChat = Omit<TelegramChat, "session" | "blockedAt">;

/** A business's daily brief: whether one is being written, and the last one that finished. */
export interface BriefState {
  readonly runningSince: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastCardKey: string | null;
  readonly lastSnapshot: BriefSnapshot | null;
}

/** How a brief run ended: with its card and snapshot, or failed, which keeps the last good brief. */
export type BriefRunResult = { readonly ok: true; readonly at: string; readonly cardKey: string; readonly snapshot: BriefSnapshot } | { readonly ok: false };

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

/** One raw outside or onboarding input retained so code can recount or re-extract it later. */
export interface StoredEvent {
  readonly id: string;
  readonly businessId: string;
  readonly source: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly receivedAt: string;
}

/**
 * Persistence for businesses, choices, cards, the outbox, raw events, chats, contacts, connections, customer threads,
 * Telegram chats, standing rules and post photos. Every method takes the session first and touches only its rows, except
 * the ones marked deployment-wide, which webhooks, the scheduled sender and the shared post playbook use.
 */
export interface Store {
  readonly kind: "supabase" | "memory";
  /** Read only this business's recorded follow-up facts. */
  listFollowups(session: string, businessId: string): Promise<RecordedFollowup[]>;
  /** Save an owner-recorded timer or its cancellation, retaining its source. */
  saveFollowup(session: string, followup: RecordedFollowup): Promise<void>;
  /** Return the session's own businesses, oldest first. The example business lives in code and is not stored. */
  listBusinesses(session: string): Promise<BusinessProfile[]>;
  getBusiness(session: string, id: string): Promise<BusinessProfile | null>;
  /** Save `business`, bump its `version`, keep a copy in its history, and return it as saved. Throws `NotFoundError` when another session owns its id. */
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
  /**
   * An invoice was paid: mark its pending reminders `superseded`, and stop its reminders still queued to send by
   * marking them `failed` with `note`. A reminder already sending or sent is left alone. Returns how many of each changed.
   */
  cancelInvoiceReminders(session: string, businessId: string, invoiceKey: string, note: string): Promise<{ readonly cards: number; readonly outbox: number }>;
  addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry>;
  /**
   * Add an entry a rule authorized, unless the session already has one with the same `ruleKey`; `null` then. One
   * statement checks and writes, so a burst of messages or a retried update queues one acknowledgment.
   */
  addRuleOutbox(session: string, entry: NewOutboxEntry & { readonly rule: OutboxRule; readonly ruleKey: string }): Promise<OutboxEntry | null>;
  listOutbox(session: string, businessId: string): Promise<OutboxEntry[]>;
  recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
  /** Return this business's retained raw inputs, oldest first, optionally from `since`. */
  listEvents(session: string, businessId: string, since?: string): Promise<StoredEvent[]>;
  /** Return the latest `limit` messages of a thread, oldest first. */
  listMessages(session: string, thread: ChatThread, limit: number): Promise<ChatMessage[]>;
  /** Append messages to a thread in order, and return them as stored. */
  addMessages(session: string, thread: ChatThread, messages: readonly NewChatMessage[]): Promise<ChatMessage[]>;
  getIntake(session: string, id: string): Promise<IntakeRecord | null>;
  /** Save the onboarding chat. Throws `NotFoundError` when another session owns its id. */
  saveIntake(session: string, intake: IntakeRecord): Promise<void>;
  /** The onboarding chat that built `businessId`, or `null` when the business came from the form or an example. */
  findIntakeByBusiness(session: string, businessId: string): Promise<IntakeRecord | null>;
  /** Count one model call against the day's cap for every visitor together; `false` once the cap is reached. Deployment-wide. */
  useAiCall(day: string, cap: number): Promise<boolean>;
  /** Count one model call against the session's own cap for the day; `false` once the cap is reached. */
  useSessionAiCall(session: string, day: string, cap: number): Promise<boolean>;
  /** Claim deletion of a sent Telegram message once, scoped to its business and session. */
  claimTelegramDeletion(session: string, businessId: string, entryId: string): Promise<OutboxEntry | null>;
  /** Mark a queued entry as sending and return it; `null` when it isn't queued, so two senders can't both send it. */
  claimOutbox(session: string, entryId: string): Promise<OutboxEntry | null>;
  settleOutbox(session: string, entryId: string, patch: OutboxPatch): Promise<void>;
  /** Queued entries due by `now`, oldest first, from every session, for the scheduled sender. Deployment-wide. */
  listDueOutbox(now: string, limit: number): Promise<{ readonly session: string; readonly entry: OutboxEntry }[]>;
  listContacts(session: string, businessId: string): Promise<Contact[]>;
  /** Add a contact, or replace the one with the same `id` or phone number. */
  saveContact(session: string, contact: NewContact): Promise<Contact>;
  deleteContact(session: string, businessId: string, contactId: string): Promise<void>;
  listConnections(session: string, businessId: string): Promise<StoredConnection[]>;
  /** Connect a service, replacing the business's connection of the same kind. */
  saveConnection(session: string, connection: NewConnection): Promise<StoredConnection>;
  deleteConnection(session: string, businessId: string, kind: ConnectionKind): Promise<void>;
  /** The connection a webhook names, with the session that owns it, or `null`. Deployment-wide. */
  findConnection(hookId: string): Promise<{ readonly session: string; readonly connection: StoredConnection } | null>;
  /** Save a photo the owner uploaded for a post. `data` has already passed `checkPhoto`. */
  savePhoto(session: string, businessId: string, data: Uint8Array, contentType: string): Promise<StoredPhoto>;
  /** A photo's bytes, or `null` when this session's business has no photo with that id. */
  getPhoto(session: string, businessId: string, photoId: string): Promise<PhotoFile | null>;
  /** Report whether this session's business has a photo with this id, without reading its bytes. */
  photoExists(session: string, businessId: string, photoId: string): Promise<boolean>;
  /** The post formats, hooks and hashtags that apply to `niche`. Shared reference rows, read-only. Deployment-wide. */
  listPostPlaybook(niche: TradeKey): Promise<PostPlaybook>;
  /**
   * Return the business's Telegram hook id, the random id in its customer link. The first call saves `candidate`;
   * later calls return the saved one. Throws `NotFoundError` when the business isn't the session's.
   */
  telegramHook(session: string, businessId: string, candidate: string): Promise<string>;
  /** The business a Telegram hook id names, with the session that owns it, or `null`. Deployment-wide. */
  findTelegramHook(hookId: string): Promise<{ readonly session: string; readonly businessId: string } | null>;
  /** The business a Telegram chat is bound to, with its session, or `null`. Deployment-wide: the bot knows only the chat id. */
  findTelegramChat(chatId: string): Promise<TelegramChat | null>;
  /** Bind a chat to one of the session's businesses, replacing any earlier binding and clearing a block. */
  bindTelegramChat(session: string, chat: NewTelegramChat): Promise<TelegramChat>;
  /** Record that the customer blocked the bot, or `null` once they unblock it. Deployment-wide. */
  setTelegramChatBlocked(chatId: string, at: string | null): Promise<void>;
  /** Report whether an update finished, so a delivery that arrives while another is still processing it is retried. Deployment-wide. */
  telegramUpdateDone(updateId: number): Promise<boolean>;
  /**
   * Claim a Telegram update so it is processed once: `true` for the caller that should process it. A failed update, or
   * one claimed more than `retakeAfterMs` ago and never finished, can be claimed again. Deployment-wide.
   */
  claimTelegramUpdate(updateId: number, now: string, retakeAfterMs: number): Promise<boolean>;
  /** Record how processing a claimed update ended. Deployment-wide. */
  finishTelegramUpdate(updateId: number, status: "done" | "failed"): Promise<void>;
  /** Append a message to a customer's thread and return it as stored. */
  addThreadMessage(session: string, message: NewThreadMessage): Promise<ThreadMessage>;
  /** Return the latest `limit` messages of a customer's thread, oldest first. */
  listThreadMessages(session: string, businessId: string, contactId: string, limit: number): Promise<ThreadMessage[]>;
  /** Return which agent owns a customer's conversation. A new conversation starts at Front Desk. */
  getConversationOwner(session: string, businessId: string, contactId: string): Promise<ConversationOwner>;
  /** Save the code-validated owner of a customer's conversation. */
  setConversationOwner(session: string, businessId: string, contactId: string, owner: ConversationOwner, at: string): Promise<void>;
  /** Return the business's saved standing rules. A rule with no saved state is off. */
  getStandingRules(session: string, businessId: string): Promise<StandingRuleState[]>;
  /** Turn a standing rule on or off at `at`, and return it as saved. */
  setStandingRule(session: string, businessId: string, rule: StandingRuleId, enabled: boolean, at: string): Promise<StandingRuleState>;
  /** Return the business's brief state, or `null` before its first brief. */
  getBriefState(session: string, businessId: string): Promise<BriefState | null>;
  /**
   * Start a brief run: `true` for the caller that should write it. A run still going is refused, unless it started more
   * than `retakeAfterMs` ago and stalled.
   */
  claimBriefRun(session: string, businessId: string, now: string, retakeAfterMs: number): Promise<boolean>;
  /** End a brief run; a success becomes the brief the owner reads, a failure leaves the last good one. */
  finishBriefRun(session: string, businessId: string, result: BriefRunResult): Promise<void>;
  /** Up to `limit` stored businesses with their sessions, for the scheduled brief. Deployment-wide. */
  listBriefTargets(limit: number): Promise<{ readonly session: string; readonly businessId: string }[]>;
  /** Delete everything the session created, as "Delete my businesses" asks. */
  reset(session: string): Promise<void>;
}

/** Raised when a record the caller named does not exist in this session. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}
