import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CardRecord, CardStatus, ChatMessage, OutboxEntry } from "@/lib/api/contract";
import type { ConnectionKind } from "@/lib/domain/connections";
import type { ConsentSource, Contact } from "@/lib/domain/contacts";
import type { IntakeDraft, ProfileChange } from "@/lib/domain/intake";
import type { BusinessProfile, CardDraft, Choice, ChoiceMap, KeyedCard, WorkflowId } from "@/lib/domain/types";
import {
  NotFoundError,
  type CardPatch,
  type ChatThread,
  type IntakeRecord,
  type NewChatMessage,
  type NewConnection,
  type NewContact,
  type NewOutboxEntry,
  type OutboxPatch,
  type Store,
  type StoredConnection,
} from "./types";

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
  delivery: OutboxEntry["delivery"];
  delivery_note: string | null;
}

interface ContactRow {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  consent_source: ConsentSource | null;
  consent_at: string | null;
  opted_out_at: string | null;
}

interface ConnectionRow {
  id: string;
  session_id: string;
  business_id: string;
  kind: ConnectionKind;
  hook_id: string;
  settings: Record<string, string>;
  secret: string | null;
  created_at: string;
}

interface ChatMessageRow {
  id: number;
  role: ChatMessage["role"];
  body: string;
  changes: readonly ProfileChange[] | null;
  created_at: string;
}

interface IntakeRow {
  id: string;
  draft: IntakeDraft;
  business_id: string | null;
}

const CARD_COLUMNS = "id, business_id, key, draft, status, edited, created_at, decided_at";
const OUTBOX_COLUMNS = "id, business_id, card_id, channel, recipient, body, sent_at, delivery, delivery_note";
const CONTACT_COLUMNS = "id, business_id, name, phone, email, consent_source, consent_at, opted_out_at";
const CONNECTION_COLUMNS = "id, session_id, business_id, kind, hook_id, settings, secret, created_at";
const MESSAGE_COLUMNS = "id, role, body, changes, created_at";

function toCard(row: CardRow): CardRecord {
  return { ...row.draft, id: row.id, key: row.key, businessId: row.business_id, status: row.status, edited: row.edited, createdAt: row.created_at, decidedAt: row.decided_at };
}

function toOutbox(row: OutboxRow): OutboxEntry {
  return { id: row.id, businessId: row.business_id, cardId: row.card_id, channel: row.channel, to: row.recipient, body: row.body, sentAt: row.sent_at, delivery: row.delivery, note: row.delivery_note };
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    consent: row.consent_source !== null && row.consent_at !== null ? { source: row.consent_source, at: row.consent_at } : null,
    optedOutAt: row.opted_out_at,
  };
}

function contactRow(session: string, contact: NewContact) {
  return {
    session_id: session,
    business_id: contact.businessId,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    consent_source: contact.consent?.source ?? null,
    consent_at: contact.consent?.at ?? null,
    opted_out_at: contact.optedOutAt,
  };
}

function toConnection(row: ConnectionRow): StoredConnection {
  return { id: row.id, businessId: row.business_id, kind: row.kind, hookId: row.hook_id, settings: row.settings, secret: row.secret, createdAt: row.created_at };
}

function toMessage(row: ChatMessageRow): ChatMessage {
  return { id: String(row.id), role: row.role, text: row.body, at: row.created_at, ...(row.changes ? { changes: row.changes } : {}) };
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

  async updatePendingCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord | null> {
    const current = await this.getCard(session, cardId);
    if (!current || current.status !== "pending") return null;
    const { id, key, businessId, status, edited, createdAt, decidedAt, ...draft } = current;
    const update = {
      draft: patch.body === undefined ? draft : { ...draft, body: patch.body },
      status: patch.status ?? status,
      edited: patch.edited ?? edited,
      decided_at: patch.decidedAt === undefined ? decidedAt : patch.decidedAt,
    };
    // `status = pending` in the filter makes the check and the write one statement: a second request matches no row.
    const { data, error } = await this.db.from("cards").update(update).eq("session_id", session).eq("id", id).eq("status", "pending").select(CARD_COLUMNS).maybeSingle();
    if (error) fail("updatePendingCard", error);
    return data ? toCard(data as CardRow) : null;
  }

  async useAiCall(day: string, cap: number): Promise<boolean> {
    // `use_ai_call` increments and compares in one statement, so concurrent callers can't overshoot the cap.
    const { data, error } = await this.db.rpc("use_ai_call", { p_day: day, p_cap: cap });
    if (error) fail("useAiCall", error);
    return data === true;
  }

  async addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry> {
    const row = {
      session_id: session,
      business_id: entry.businessId,
      card_id: entry.cardId,
      channel: entry.channel,
      recipient: entry.to,
      body: entry.body,
      delivery: entry.delivery ?? "yours",
      delivery_note: entry.note ?? null,
      ...(entry.sentAt ? { sent_at: entry.sentAt } : {}),
    };
    const { data, error } = await this.db.from("outbox").insert(row).select(OUTBOX_COLUMNS).single();
    if (error) fail("addOutbox", error);
    return toOutbox(data as OutboxRow);
  }

  async listOutbox(session: string, businessId: string): Promise<OutboxEntry[]> {
    const { data, error } = await this.db.from("outbox").select(OUTBOX_COLUMNS).eq("session_id", session).eq("business_id", businessId).order("sent_at", { ascending: false });
    if (error) fail("listOutbox", error);
    return (data ?? []).map((row) => toOutbox(row as OutboxRow));
  }

  async claimOutbox(session: string, entryId: string): Promise<OutboxEntry | null> {
    // `delivery = queued` in the filter makes the check and the write one statement: a second sender matches no row.
    const { data, error } = await this.db.from("outbox").update({ delivery: "sending" }).eq("session_id", session).eq("id", entryId).eq("delivery", "queued").select(OUTBOX_COLUMNS).maybeSingle();
    if (error) fail("claimOutbox", error);
    return data ? toOutbox(data as OutboxRow) : null;
  }

  async settleOutbox(session: string, entryId: string, patch: OutboxPatch): Promise<void> {
    const update = {
      delivery: patch.delivery,
      ...(patch.note === undefined ? {} : { delivery_note: patch.note }),
      ...(patch.providerId === undefined ? {} : { provider_id: patch.providerId }),
      ...(patch.sentAt === undefined ? {} : { sent_at: patch.sentAt }),
    };
    const { error } = await this.db.from("outbox").update(update).eq("session_id", session).eq("id", entryId);
    if (error) fail("settleOutbox", error);
  }

  async listDueOutbox(now: string, limit: number): Promise<{ readonly session: string; readonly entry: OutboxEntry }[]> {
    const { data, error } = await this.db.from("outbox").select(`session_id, ${OUTBOX_COLUMNS}`).eq("delivery", "queued").lte("sent_at", now).order("sent_at").limit(limit);
    if (error) fail("listDueOutbox", error);
    return (data ?? []).map((row) => ({ session: (row as { session_id: string }).session_id, entry: toOutbox(row as OutboxRow) }));
  }

  async listContacts(session: string, businessId: string): Promise<Contact[]> {
    const { data, error } = await this.db.from("contacts").select(CONTACT_COLUMNS).eq("session_id", session).eq("business_id", businessId).order("name");
    if (error) fail("listContacts", error);
    return (data ?? []).map((row) => toContact(row as ContactRow));
  }

  async saveContact(session: string, contact: NewContact): Promise<Contact> {
    // One contact per phone number: a save for a number already on file updates that contact.
    let id = contact.id;
    if (id === undefined && contact.phone !== null) {
      const { data, error } = await this.db.from("contacts").select("id").eq("session_id", session).eq("business_id", contact.businessId).eq("phone", contact.phone).maybeSingle();
      if (error) fail("saveContact", error);
      id = (data as { id: string } | null)?.id;
    }
    const row = contactRow(session, contact);
    const query = id === undefined ? this.db.from("contacts").insert(row) : this.db.from("contacts").update(row).eq("session_id", session).eq("id", id);
    const { data, error } = await query.select(CONTACT_COLUMNS).single();
    if (error) fail("saveContact", error);
    return toContact(data as ContactRow);
  }

  async deleteContact(session: string, businessId: string, contactId: string): Promise<void> {
    const { error } = await this.db.from("contacts").delete().eq("session_id", session).eq("business_id", businessId).eq("id", contactId);
    if (error) fail("deleteContact", error);
  }

  async listConnections(session: string, businessId: string): Promise<StoredConnection[]> {
    const { data, error } = await this.db.from("connections").select(CONNECTION_COLUMNS).eq("session_id", session).eq("business_id", businessId);
    if (error) fail("listConnections", error);
    return (data ?? []).map((row) => toConnection(row as ConnectionRow));
  }

  async saveConnection(session: string, connection: NewConnection): Promise<StoredConnection> {
    const row = { session_id: session, business_id: connection.businessId, kind: connection.kind, hook_id: connection.hookId, settings: connection.settings, secret: connection.secret };
    // A new hook id replaces the old one, so the old webhook URLs stop working once the owner reconnects.
    const { data, error } = await this.db.from("connections").upsert(row, { onConflict: "session_id,business_id,kind" }).select(CONNECTION_COLUMNS).single();
    if (error) fail("saveConnection", error);
    return toConnection(data as ConnectionRow);
  }

  async deleteConnection(session: string, businessId: string, kind: ConnectionKind): Promise<void> {
    const { error } = await this.db.from("connections").delete().eq("session_id", session).eq("business_id", businessId).eq("kind", kind);
    if (error) fail("deleteConnection", error);
  }

  async findConnection(hookId: string): Promise<{ readonly session: string; readonly connection: StoredConnection } | null> {
    const { data, error } = await this.db.from("connections").select(CONNECTION_COLUMNS).eq("hook_id", hookId).maybeSingle();
    if (error) fail("findConnection", error);
    const row = data as ConnectionRow | null;
    return row === null ? null : { session: row.session_id, connection: toConnection(row) };
  }

  async recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    const { error } = await this.db.from("events").insert({ session_id: session, business_id: businessId, source, payload });
    if (error) fail("recordEvent", error);
  }

  async listMessages(session: string, thread: ChatThread, limit: number): Promise<ChatMessage[]> {
    // Newest first so `limit` keeps the latest messages, then reversed to read oldest first.
    const { data, error } = await this.db
      .from("chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("session_id", session)
      .eq("thread_kind", thread.kind)
      .eq("thread_id", thread.id)
      .order("id", { ascending: false })
      .limit(limit);
    if (error) fail("listMessages", error);
    return (data ?? []).map((row) => toMessage(row as ChatMessageRow)).reverse();
  }

  async addMessages(session: string, thread: ChatThread, messages: readonly NewChatMessage[]): Promise<ChatMessage[]> {
    if (messages.length === 0) return [];
    const rows = messages.map((message) => ({ session_id: session, thread_kind: thread.kind, thread_id: thread.id, role: message.role, body: message.text, changes: message.changes ?? null }));
    const { data, error } = await this.db.from("chat_messages").insert(rows).select(MESSAGE_COLUMNS);
    if (error) fail("addMessages", error);
    // Identity ids follow insert order; sorting by them keeps the returned rows in that order too.
    const saved = (data ?? []).map((row) => row as ChatMessageRow).sort((a, b) => a.id - b.id);
    return saved.map(toMessage);
  }

  async getIntake(session: string, id: string): Promise<IntakeRecord | null> {
    const { data, error } = await this.db.from("intake_drafts").select("id, draft, business_id").eq("session_id", session).eq("id", id).maybeSingle();
    if (error) fail("getIntake", error);
    // `draft` is written only by `saveIntake` from a typed `IntakeDraft`.
    const row = data as IntakeRow | null;
    return row ? { id: row.id, draft: row.draft, businessId: row.business_id } : null;
  }

  async saveIntake(session: string, intake: IntakeRecord): Promise<void> {
    const { error } = await this.db
      .from("intake_drafts")
      .upsert({ id: intake.id, session_id: session, draft: intake.draft, business_id: intake.businessId, updated_at: new Date().toISOString() });
    if (error) fail("saveIntake", error);
  }

  async reset(session: string): Promise<void> {
    // Outbox rows cascade from cards; the other tables are cleared one by one.
    for (const table of ["cards", "workflow_choices", "events", "chat_messages", "intake_drafts", "contacts", "connections", "businesses"] as const) {
      const { error } = await this.db.from(table).delete().eq("session_id", session);
      if (error) fail(`reset ${table}`, error);
    }
  }
}
