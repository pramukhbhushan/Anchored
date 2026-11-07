import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CardRecord, CardStatus, OutboxEntry } from "@/lib/api/contract";
import type { BusinessProfile, CardDraft, Choice, ChoiceMap, KeyedCard, WorkflowId } from "@/lib/domain/types";
import { NotFoundError, type CardPatch, type NewOutboxEntry, type Store } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `SupabaseStore` persists Anchored data in the Postgres tables created by
// `supabase/migrations`. It connects with the service role key from the server
// only; row-level security has no policies, so the public anon key reads nothing.

// =============================================================================
// Row shapes, as Postgres returns them
// =============================================================================

interface CardRow {
  id: string;
  business_id: string;
  key: string;
  draft: CardDraft;
  status: CardStatus;
  edited: boolean;
  created_at: string;
  decided_at: string | null;
}

interface OutboxRow {
  id: string;
  business_id: string;
  card_id: string;
  channel: OutboxEntry["channel"];
  recipient: string;
  body: string;
  sent_at: string;
}

const CARD_COLUMNS = "id, business_id, key, draft, status, edited, created_at, decided_at";
const OUTBOX_COLUMNS = "id, business_id, card_id, channel, recipient, body, sent_at";

function toCard(row: CardRow): CardRecord {
  return { ...row.draft, id: row.id, key: row.key, businessId: row.business_id, status: row.status, edited: row.edited, createdAt: row.created_at, decidedAt: row.decided_at };
}

function toOutbox(row: OutboxRow): OutboxEntry {
  return { id: row.id, businessId: row.business_id, cardId: row.card_id, channel: row.channel, to: row.recipient, body: row.body, sentAt: row.sent_at };
}

/** Throw a store error that names the operation and keeps Supabase's error as the cause. */
function fail(operation: string, error: { message: string }): never {
  throw new Error(`[SupabaseStore] ${operation} failed: ${error.message}`, { cause: error });
}

// =============================================================================
// Store
// =============================================================================

/** Postgres-backed `Store` on Supabase. */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listBusinesses(session: string): Promise<BusinessProfile[]> {
    const { data, error } = await this.db.from("businesses").select("profile").eq("session_id", session).order("created_at");
    if (error) fail("listBusinesses", error);
    // `profile` is written only by `saveBusiness` from a typed `BusinessProfile`.
    return (data ?? []).map((row) => row.profile as BusinessProfile);
  }

  async getBusiness(session: string, id: string): Promise<BusinessProfile | null> {
    const { data, error } = await this.db.from("businesses").select("profile").eq("session_id", session).eq("id", id).maybeSingle();
    if (error) fail("getBusiness", error);
    // `profile` is written only by `saveBusiness` from a typed `BusinessProfile`.
    return data ? (data.profile as BusinessProfile) : null;
  }

  async saveBusiness(session: string, business: BusinessProfile): Promise<void> {
    const { error } = await this.db.from("businesses").upsert({ id: business.id, session_id: session, profile: business });
    if (error) fail("saveBusiness", error);
  }

  async getChoices(session: string, businessId: string): Promise<ChoiceMap> {
    const { data, error } = await this.db.from("workflow_choices").select("workflow, choice").eq("session_id", session).eq("business_id", businessId);
    if (error) fail("getChoices", error);
    // Both columns are written only by `setChoice` with typed values.
    return Object.fromEntries((data ?? []).map((row) => [row.workflow as WorkflowId, row.choice as Choice]));
  }

  async setChoice(session: string, businessId: string, workflow: WorkflowId, choice: Choice): Promise<void> {
    const { error } = await this.db
      .from("workflow_choices")
      .upsert({ session_id: session, business_id: businessId, workflow, choice, updated_at: new Date().toISOString() });
    if (error) fail("setChoice", error);
  }

  async ensureCards(session: string, businessId: string, drafts: readonly KeyedCard[]): Promise<void> {
    if (drafts.length === 0) return;
    const rows = drafts.map(({ key, ...draft }) => ({ session_id: session, business_id: businessId, key, draft }));
    // `ignoreDuplicates` keeps a decided card's state when the same draft syncs again.
    const { error } = await this.db.from("cards").upsert(rows, { onConflict: "session_id,key", ignoreDuplicates: true });
    if (error) fail("ensureCards", error);
  }

  async listCards(session: string, businessId: string): Promise<CardRecord[]> {
    const { data, error } = await this.db.from("cards").select(CARD_COLUMNS).eq("session_id", session).eq("business_id", businessId).order("created_at");
    if (error) fail("listCards", error);
    return (data ?? []).map((row) => toCard(row as CardRow));
  }

  async getCard(session: string, cardId: string): Promise<CardRecord | null> {
    const { data, error } = await this.db.from("cards").select(CARD_COLUMNS).eq("session_id", session).eq("id", cardId).maybeSingle();
    if (error) fail("getCard", error);
    return data ? toCard(data as CardRow) : null;
  }

  async updateCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord> {
    const current = await this.getCard(session, cardId);
    if (!current) throw new NotFoundError(`Card ${cardId} not found in this session.`);
    const { id, key, businessId, status, edited, createdAt, decidedAt, ...draft } = current;
    const update = {
      draft: patch.body === undefined ? draft : { ...draft, body: patch.body },
      status: patch.status ?? status,
      edited: patch.edited ?? edited,
      decided_at: patch.decidedAt === undefined ? decidedAt : patch.decidedAt,
    };
    const { data, error } = await this.db.from("cards").update(update).eq("session_id", session).eq("id", id).select(CARD_COLUMNS).single();
    if (error) fail("updateCard", error);
    return toCard(data as CardRow);
  }

  async addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry> {
    const row = { session_id: session, business_id: entry.businessId, card_id: entry.cardId, channel: entry.channel, recipient: entry.to, body: entry.body, ...(entry.sentAt ? { sent_at: entry.sentAt } : {}) };
    const { data, error } = await this.db.from("outbox").insert(row).select(OUTBOX_COLUMNS).single();
    if (error) fail("addOutbox", error);
    return toOutbox(data as OutboxRow);
  }

  async listOutbox(session: string, businessId: string): Promise<OutboxEntry[]> {
    const { data, error } = await this.db.from("outbox").select(OUTBOX_COLUMNS).eq("session_id", session).eq("business_id", businessId).order("sent_at", { ascending: false });
    if (error) fail("listOutbox", error);
    return (data ?? []).map((row) => toOutbox(row as OutboxRow));
  }

  async recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    const { error } = await this.db.from("events").insert({ session_id: session, business_id: businessId, source, payload });
    if (error) fail("recordEvent", error);
  }

  async reset(session: string): Promise<void> {
    // Outbox rows cascade from cards; the other tables are cleared one by one.
    for (const table of ["cards", "workflow_choices", "events", "businesses"] as const) {
      const { error } = await this.db.from(table).delete().eq("session_id", session);
      if (error) fail(`reset ${table}`, error);
    }
  }
}
