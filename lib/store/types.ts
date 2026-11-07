import type { CardRecord, CardStatus, OutboxEntry } from "@/lib/api/contract";
import type { BusinessProfile, Choice, ChoiceMap, KeyedCard, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The `Store` interface every persistence backend implements. Each call takes
// the demo session id, so one judge's choices and cards never reach another's.
// `SupabaseStore` is the real backend; `MemoryStore` runs the demo without keys.

/** Fields of a card that a decision or a rewrite may change. */
export interface CardPatch {
  readonly status?: CardStatus;
  readonly body?: string;
  readonly edited?: boolean;
  readonly decidedAt?: string | null;
}

/** A new outbox entry before the store assigns its id. */
export type NewOutboxEntry = Omit<OutboxEntry, "id" | "sentAt"> & { readonly sentAt?: string };

/** Persistence for businesses, choices, cards, the outbox and raw events. */
export interface Store {
  readonly kind: "supabase" | "memory";
  /** Return the session's own businesses, oldest first. Case studies are not stored. */
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
  addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry>;
  listOutbox(session: string, businessId: string): Promise<OutboxEntry[]>;
  recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
  /** Delete everything the session created, so the demo starts fresh. */
  reset(session: string): Promise<void>;
}

/** Raised when a record the caller named does not exist in this session. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}
