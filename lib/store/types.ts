import type { CardRecord, CardStatus, ChatMessage, Delivery, OutboxEntry } from "@/lib/api/contract";
import type { ConnectionKind } from "@/lib/domain/connections";
import type { Contact } from "@/lib/domain/contacts";
import type { IntakeDraft } from "@/lib/domain/intake";
import type { PostPlaybook } from "@/lib/domain/playbook";
import type { BusinessProfile, Choice, ChoiceMap, KeyedCard, ProfileChangeSource, TradeKey, WorkflowId } from "@/lib/domain/types";

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

/**
 * Persistence for businesses, choices, cards, the outbox, raw events, chats, contacts and connections. Every method
 * takes the session first and touches only its rows, except the four marked deployment-wide.
 */
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
  /**
   * An invoice was paid: mark its pending reminders `superseded`, and stop its reminders still queued to send by
   * marking them `failed` with `note`. A reminder already sending or sent is left alone. Returns how many of each changed.
   */
  cancelInvoiceReminders(session: string, businessId: string, invoiceKey: string, note: string): Promise<{ readonly cards: number; readonly outbox: number }>;
  addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry>;
  listOutbox(session: string, businessId: string): Promise<OutboxEntry[]>;
  recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
  /** Return the latest `limit` messages of a thread, oldest first. */
  listMessages(session: string, thread: ChatThread, limit: number): Promise<ChatMessage[]>;
  /** Append messages to a thread in order, and return them as stored. */
  addMessages(session: string, thread: ChatThread, messages: readonly NewChatMessage[]): Promise<ChatMessage[]>;
  getIntake(session: string, id: string): Promise<IntakeRecord | null>;
  saveIntake(session: string, intake: IntakeRecord): Promise<void>;
  /** The onboarding chat that built `businessId`, or `null` when the business came from the form or an example. */
  findIntakeByBusiness(session: string, businessId: string): Promise<IntakeRecord | null>;
  /** Count one model call against the day's cap for every visitor together; `false` once the cap is reached. Deployment-wide. */
  useAiCall(day: string, cap: number): Promise<boolean>;
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
  /** Delete everything the session created, as "Delete my businesses" asks. */
  reset(session: string): Promise<void>;
}

/** Raised when a record the caller named does not exist in this session. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}
