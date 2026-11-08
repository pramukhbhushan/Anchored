import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CardRecord, CardStatus, ChatMessage, OutboxEntry } from "@/lib/api/contract";
import type { IntakeDraft, ProfileChange } from "@/lib/domain/intake";
import type { BusinessProfile, CardDraft, Choice, ChoiceMap, ConversationOwner, KeyedCard, ProfileChangeSource, WorkflowId } from "@/lib/domain/types";
import {
  NotFoundError,
  type CardPatch,
  type ChatThread,
  type Conversation,
  type ConversationChannel,
  type ConversationPatch,
  type DeliveryResult,
  type IntakeRecord,
  type NewChatMessage,
  type NewOutboxEntry,
  type Owned,
  type ProfileVersion,
  type Store,
} from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `SupabaseStore` persists Anchored data in the Postgres tables created by
// `supabase/migrations`. It connects with the service role key from the server
// only; row-level security has no policies, so the public anon key reads nothing.
// `resolveChannelLink`, `findConversation` and `listUndelivered` are the lookups
// that skip the session filter, for the Telegram webhook and the delivery job.

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
  contact: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
}

interface VersionRow {
  version: number;
  changed_by: ProfileChangeSource;
  snapshot: BusinessProfile;
  created_at: string;
}

interface ConversationRow {
  session_id: string;
  business_id: string;
  channel: ConversationChannel;
  contact: string;
  display_name: string;
  owner_agent: ConversationOwner;
  opted_out: boolean;
  updated_at: string;
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
const OUTBOX_COLUMNS = "id, business_id, card_id, channel, recipient, body, sent_at, contact, delivered_at, delivery_error";
const CONVERSATION_COLUMNS = "session_id, business_id, channel, contact, display_name, owner_agent, opted_out, updated_at";
const MESSAGE_COLUMNS = "id, role, body, changes, created_at";

function toCard(row: CardRow): CardRecord {
  return { ...row.draft, id: row.id, key: row.key, businessId: row.business_id, status: row.status, edited: row.edited, createdAt: row.created_at, decidedAt: row.decided_at };
}

function toOutbox(row: OutboxRow): OutboxEntry {
  return {
    id: row.id,
    businessId: row.business_id,
    cardId: row.card_id,
    channel: row.channel,
    to: row.recipient,
    body: row.body,
    sentAt: row.sent_at,
    ...(row.contact !== null ? { contact: row.contact } : {}),
    ...(row.delivered_at !== null ? { deliveredAt: row.delivered_at } : {}),
    ...(row.delivery_error !== null ? { deliveryError: row.delivery_error } : {}),
  };
}

function toConversation(row: ConversationRow): Conversation {
  return { channel: row.channel, contact: row.contact, businessId: row.business_id, displayName: row.display_name, owner: row.owner_agent, optedOut: row.opted_out, updatedAt: row.updated_at };
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

  async saveBusiness(session: string, business: BusinessProfile, changedBy: ProfileChangeSource = "owner"): Promise<BusinessProfile> {
    // The store owns the count: read the newest stored version instead of trusting the caller's copy.
    const latest = await this.db.from("profile_versions").select("version").eq("session_id", session).eq("business_id", business.id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latest.error) fail("saveBusiness", latest.error);
    const version = ((latest.data as { version: number } | null)?.version ?? 0) + 1;
    const saved: BusinessProfile = { ...business, version };
    const { error } = await this.db.from("businesses").upsert({ id: business.id, session_id: session, profile: saved });
    if (error) fail("saveBusiness", error);
    // Two saves racing for one number keep the first copy; the profile itself is still saved.
    const history = await this.db
      .from("profile_versions")
      .upsert({ session_id: session, business_id: business.id, version, changed_by: changedBy, snapshot: saved }, { onConflict: "session_id,business_id,version", ignoreDuplicates: true });
    if (history.error) fail("saveBusiness history", history.error);
    return saved;
  }

  async listProfileVersions(session: string, businessId: string): Promise<ProfileVersion[]> {
    const { data, error } = await this.db.from("profile_versions").select("version, changed_by, snapshot, created_at").eq("session_id", session).eq("business_id", businessId).order("version", { ascending: false });
    if (error) fail("listProfileVersions", error);
    // `snapshot` is written only by `saveBusiness` from a typed `BusinessProfile`.
    return (data ?? []).map((row) => {
      const version = row as VersionRow;
      return { version: version.version, changedBy: version.changed_by, savedAt: version.created_at, snapshot: version.snapshot };
    });
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

  async supersedePendingCards(session: string, businessId: string, contact: string, exceptKey: string): Promise<number> {
    const { data, error } = await this.db
      .from("cards")
      .update({ status: "superseded", decided_at: new Date().toISOString() })
      .eq("session_id", session)
      .eq("business_id", businessId)
      .eq("status", "pending")
      .eq("draft->>contact", contact)
      .neq("key", exceptKey)
      .select("id");
    if (error) fail("supersedePendingCards", error);
    return (data ?? []).length;
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
      contact: entry.contact ?? null,
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

  async markDelivered(session: string, outboxId: string, result: DeliveryResult): Promise<void> {
    const update = "error" in result ? { delivery_error: result.error } : { delivered_at: result.deliveredAt };
    const { data, error } = await this.db.from("outbox").update(update).eq("session_id", session).eq("id", outboxId).select("id").maybeSingle();
    if (error) fail("markDelivered", error);
    if (!data) throw new NotFoundError(`Outbox entry ${outboxId} not found in this session.`);
  }

  async listUndelivered(now: Date, limit: number): Promise<Owned<OutboxEntry>[]> {
    const { data, error } = await this.db
      .from("outbox")
      .select(`session_id, ${OUTBOX_COLUMNS}`)
      .eq("channel", "telegram")
      .is("delivered_at", null)
      .is("delivery_error", null)
      .lte("sent_at", now.toISOString())
      .order("sent_at")
      .limit(limit);
    if (error) fail("listUndelivered", error);
    return (data ?? []).map((row) => {
      const typed = row as OutboxRow & { session_id: string };
      return { session: typed.session_id, value: toOutbox(typed) };
    });
  }

  async ensureChannelLink(session: string, businessId: string, channel: ConversationChannel): Promise<string> {
    const found = await this.db.from("channel_links").select("code").eq("session_id", session).eq("business_id", businessId).eq("channel", channel).maybeSingle();
    if (found.error) fail("ensureChannelLink", found.error);
    if (found.data) return (found.data as { code: string }).code;
    // 16 random bytes: the code is all that stands between a stranger and this business's chat, so it must not be guessable.
    const code = randomBytes(16).toString("base64url");
    const { error } = await this.db.from("channel_links").insert({ code, session_id: session, business_id: businessId, channel });
    if (error) fail("ensureChannelLink", error);
    return code;
  }

  async resolveChannelLink(code: string): Promise<Owned<{ businessId: string; channel: ConversationChannel }> | null> {
    const { data, error } = await this.db.from("channel_links").select("session_id, business_id, channel").eq("code", code).maybeSingle();
    if (error) fail("resolveChannelLink", error);
    const row = data as { session_id: string; business_id: string; channel: ConversationChannel } | null;
    return row ? { session: row.session_id, value: { businessId: row.business_id, channel: row.channel } } : null;
  }

  async getConversation(session: string, channel: ConversationChannel, contact: string): Promise<Conversation | null> {
    const { data, error } = await this.db.from("conversations").select(CONVERSATION_COLUMNS).eq("session_id", session).eq("channel", channel).eq("contact", contact).maybeSingle();
    if (error) fail("getConversation", error);
    return data ? toConversation(data as ConversationRow) : null;
  }

  async bindConversation(session: string, conversation: Conversation): Promise<void> {
    // The chat is the key, so binding it here replaces a binding to another business, as a new start link intends.
    const { error } = await this.db.from("conversations").upsert({
      session_id: session,
      business_id: conversation.businessId,
      channel: conversation.channel,
      contact: conversation.contact,
      display_name: conversation.displayName,
      owner_agent: conversation.owner,
      opted_out: conversation.optedOut,
      updated_at: new Date().toISOString(),
    });
    if (error) fail("bindConversation", error);
  }

  async updateConversation(session: string, channel: ConversationChannel, contact: string, patch: ConversationPatch): Promise<Conversation | null> {
    const update = {
      ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
      ...(patch.owner !== undefined ? { owner_agent: patch.owner } : {}),
      ...(patch.optedOut !== undefined ? { opted_out: patch.optedOut } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.db.from("conversations").update(update).eq("session_id", session).eq("channel", channel).eq("contact", contact).select(CONVERSATION_COLUMNS).maybeSingle();
    if (error) fail("updateConversation", error);
    return data ? toConversation(data as ConversationRow) : null;
  }

  async findConversation(channel: ConversationChannel, contact: string): Promise<Owned<Conversation> | null> {
    const { data, error } = await this.db.from("conversations").select(CONVERSATION_COLUMNS).eq("channel", channel).eq("contact", contact).maybeSingle();
    if (error) fail("findConversation", error);
    const row = data as ConversationRow | null;
    return row ? { session: row.session_id, value: toConversation(row) } : null;
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
    for (const table of ["cards", "workflow_choices", "events", "chat_messages", "intake_drafts", "profile_versions", "conversations", "channel_links", "businesses"] as const) {
      const { error } = await this.db.from(table).delete().eq("session_id", session);
      if (error) fail(`reset ${table}`, error);
    }
  }
}
