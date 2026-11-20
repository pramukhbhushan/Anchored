import type { RecordedFollowup } from "@/lib/domain/followups";
import { randomUUID } from "node:crypto";
import type { CardRecord, ChatMessage, OutboxEntry } from "@/lib/api/contract";
import type { ConnectionKind } from "@/lib/domain/connections";
import type { Contact } from "@/lib/domain/contacts";
import { playbookForNiche, type PostPlaybook } from "@/lib/domain/playbook";
import { PLAYBOOK_SEED } from "@/lib/domain/playbook-seed";
import { defaultRuleState, type OutboxRule, type StandingRuleId, type StandingRuleState } from "@/lib/domain/rules";
import { inOrder, type NewThreadMessage, type ThreadMessage } from "@/lib/domain/threads";
import type { BusinessProfile, Choice, ChoiceMap, ConversationOwner, KeyedCard, ProfileChangeSource, TradeKey, WorkflowId } from "@/lib/domain/types";
import {
  NotFoundError,
  type CardPatch,
  type ChatThread,
  type IntakeRecord,
  type NewChatMessage,
  type NewConnection,
  type NewContact,
  type NewOutboxEntry,
  type NewTelegramChat,
  type OutboxPatch,
  type PhotoFile,
  type ProfileVersion,
  type Store,
  type StoredEvent,
  type StoredConnection,
  type StoredPhoto,
  type TelegramChat,
  type BriefRunResult,
  type BriefState,
} from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `MemoryStore` keeps every session's data in process memory, so local
// development and CI run with no Supabase keys. Data lives only as long as the
// server process, and each serverless instance has its own copy, so production
// uses `SupabaseStore`.

interface SessionData {
  readonly followups: Map<string, RecordedFollowup>;
  readonly businesses: Map<string, BusinessProfile>;
  readonly choices: Map<string, Map<WorkflowId, Choice>>;
  readonly cards: Map<string, CardRecord>;
  readonly outbox: OutboxEntry[];
  readonly contacts: Map<string, Contact>;
  readonly connections: Map<string, StoredConnection>;
  readonly events: StoredEvent[];
  /** Chat messages by thread, keyed `${kind}:${id}`. */
  readonly threads: Map<string, ChatMessage[]>;
  readonly intakes: Map<string, IntakeRecord>;
  /** Saved profile versions by business id, oldest first. */
  readonly versions: Map<string, ProfileVersion[]>;
  /** Customer thread messages, in the order they were added. */
  readonly threadMessages: ThreadMessage[];
  /** Conversation owner by `${businessId}:${contactId}`. */
  readonly conversationOwners: Map<string, ConversationOwner>;
  /** Standing rules, keyed `${businessId}:${rule}`. */
  readonly rules: Map<string, StandingRuleState>;
  /** Telegram hook ids by business id. */
  readonly telegramHooks: Map<string, string>;
  /** The keys of outbox entries a rule authorized, so each key queues once. */
  readonly ruleKeys: Set<string>;
  /** Each business's brief state, by business id. */
  readonly briefs: Map<string, BriefState>;
  /** Uploaded photos by id. */
  readonly photos: Map<string, StoredPhoto & PhotoFile>;
}

/** A Telegram update's processing state. */
interface UpdateClaim {
  status: "claimed" | "done" | "failed";
  claimedAt: string;
}

// Past this many photos a session's oldest is dropped, so photos can't fill a server's memory.
const MAX_PHOTOS_PER_SESSION = 60;

// Past this many sessions the oldest is dropped, so a server on memory can't grow without bound.
const MAX_SESSIONS = 2000;

function threadKey(thread: ChatThread): string {
  return `${thread.kind}:${thread.id}`;
}

/** In-process `Store` for local runs and CI. */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private readonly sessions = new Map<string, SessionData>();
  private readonly aiCalls = new Map<string, number>();
  // The shared bot's records belong to no one session: a webhook knows only a chat id, an update id or a hook id.
  private readonly telegramChats = new Map<string, TelegramChat>();
  private readonly telegramUpdates = new Map<number, UpdateClaim>();

  /** Return the session's data for a write, creating it on first use and evicting the oldest past `MAX_SESSIONS`. */
  private data(session: string): SessionData {
    let found = this.sessions.get(session);
    if (!found) {
      // Bound memory: a server can see many sessions, and on memory each one only needs to last a visit.
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = this.sessions.keys().next().value;
        if (oldest !== undefined) this.sessions.delete(oldest);
      }
      found = {
        followups: new Map(),
        businesses: new Map(),
        choices: new Map(),
        cards: new Map(),
        outbox: [],
        contacts: new Map(),
        connections: new Map(),
        events: [],
        threads: new Map(),
        intakes: new Map(),
        versions: new Map(),
        threadMessages: [],
        conversationOwners: new Map(),
        rules: new Map(),
        telegramHooks: new Map(),
        ruleKeys: new Set(),
        briefs: new Map(),
        photos: new Map(),
      };
      this.sessions.set(session, found);
    }
    return found;
  }

  /** Return the session's data for a read, without creating an entry for a visitor who has stored nothing. */
  private peek(session: string): SessionData | undefined {
    return this.sessions.get(session);
  }

  async listFollowups(session: string, businessId: string): Promise<RecordedFollowup[]> {
    return [...(this.peek(session)?.followups.values() ?? [])].filter((record) => record.businessId === businessId).map((record) => ({ ...record }));
  }

  async saveFollowup(session: string, followup: RecordedFollowup): Promise<void> {
    const records = this.data(session).followups;
    const before = records.get(followup.id);
    if (before !== undefined && before.businessId !== followup.businessId) throw new NotFoundError("Follow-up not found in this business.");
    records.set(followup.id, { ...followup });
  }

  async listBusinesses(session: string): Promise<BusinessProfile[]> {
    return [...(this.peek(session)?.businesses.values() ?? [])];
  }

  async getBusiness(session: string, id: string): Promise<BusinessProfile | null> {
    return this.peek(session)?.businesses.get(id) ?? null;
  }

  async saveBusiness(session: string, business: BusinessProfile, changedBy: ProfileChangeSource = "owner"): Promise<BusinessProfile> {
    const data = this.data(session);
    // The store owns the count, so a caller holding an older copy can't reuse a version number.
    const history = data.versions.get(business.id) ?? [];
    const version = (history.at(-1)?.version ?? 0) + 1;
    const saved: BusinessProfile = { ...business, version };
    data.businesses.set(business.id, saved);
    data.versions.set(business.id, [...history, { version, changedBy, savedAt: new Date().toISOString(), snapshot: saved }]);
    return saved;
  }

  async listProfileVersions(session: string, businessId: string): Promise<ProfileVersion[]> {
    return [...(this.peek(session)?.versions.get(businessId) ?? [])].reverse();
  }

  async getChoices(session: string, businessId: string): Promise<ChoiceMap> {
    return Object.fromEntries(this.peek(session)?.choices.get(businessId) ?? []);
  }

  async setChoice(session: string, businessId: string, workflow: WorkflowId, choice: Choice): Promise<void> {
    const all = this.data(session).choices;
    const forBusiness = all.get(businessId) ?? new Map<WorkflowId, Choice>();
    forBusiness.set(workflow, choice);
    all.set(businessId, forBusiness);
  }

  async ensureCards(session: string, businessId: string, drafts: readonly KeyedCard[]): Promise<void> {
    const cards = this.data(session).cards;
    const existingKeys = new Set([...cards.values()].map((card) => card.key));
    for (const draft of drafts) {
      if (existingKeys.has(draft.key)) continue;
      existingKeys.add(draft.key);
      const id = randomUUID();
      cards.set(id, { ...draft, id, businessId, status: "pending", edited: false, createdAt: new Date().toISOString(), decidedAt: null });
    }
  }

  async listCards(session: string, businessId: string): Promise<CardRecord[]> {
    return [...(this.peek(session)?.cards.values() ?? [])].filter((card) => card.businessId === businessId);
  }

  async getCard(session: string, cardId: string): Promise<CardRecord | null> {
    return this.peek(session)?.cards.get(cardId) ?? null;
  }

  async updateCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord> {
    const cards = this.data(session).cards;
    const card = cards.get(cardId);
    if (!card) throw new NotFoundError(`Card ${cardId} not found in this session.`);
    const updated: CardRecord = { ...card, ...patch };
    cards.set(cardId, updated);
    return updated;
  }

  async updatePendingCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord | null> {
    // Check and write happen with no await between them, so no other request can slip in.
    const card = this.peek(session)?.cards.get(cardId);
    if (!card || card.status !== "pending") return null;
    return this.updateCard(session, cardId, patch);
  }

  async supersedePendingCards(session: string, businessId: string, contact: string, exceptKey: string): Promise<number> {
    const cards = this.peek(session)?.cards;
    if (!cards) return 0;
    let changed = 0;
    for (const [id, card] of cards) {
      if (card.businessId !== businessId || card.contact !== contact || card.key === exceptKey || card.status !== "pending") continue;
      cards.set(id, { ...card, status: "superseded", decidedAt: new Date().toISOString() });
      changed += 1;
    }
    return changed;
  }

  async cancelInvoiceReminders(session: string, businessId: string, invoiceKey: string, note: string): Promise<{ readonly cards: number; readonly outbox: number }> {
    const data = this.peek(session);
    if (!data) return { cards: 0, outbox: 0 };
    const ids = new Set<string>();
    let cards = 0;
    for (const [id, card] of data.cards) {
      if (card.businessId !== businessId || card.skill !== "nudger" || card.invoice?.key !== invoiceKey) continue;
      ids.add(id);
      if (card.status !== "pending") continue;
      data.cards.set(id, { ...card, status: "superseded", decidedAt: new Date().toISOString() });
      cards += 1;
    }
    let outbox = 0;
    data.outbox.forEach((entry, index) => {
      if (entry.cardId === null || !ids.has(entry.cardId) || entry.delivery !== "queued") return;
      data.outbox[index] = { ...entry, delivery: "failed", note };
      outbox += 1;
    });
    return { cards, outbox };
  }

  async useAiCall(day: string, cap: number): Promise<boolean> {
    const used = this.aiCalls.get(day) ?? 0;
    if (used >= cap) return false;
    // Only today's count matters; drop older days so the map stays one entry.
    this.aiCalls.clear();
    this.aiCalls.set(day, used + 1);
    return true;
  }

  async addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry> {
    const saved: OutboxEntry = { ...entry, id: randomUUID(), sentAt: entry.sentAt ?? new Date().toISOString(), delivery: entry.delivery ?? "yours", note: entry.note ?? null };
    this.data(session).outbox.push(saved);
    return saved;
  }

  async addRuleOutbox(session: string, entry: NewOutboxEntry & { readonly rule: OutboxRule; readonly ruleKey: string }): Promise<OutboxEntry | null> {
    // Check and write happen with no await between them, so a second entry with the key can't slip in.
    const keys = this.data(session).ruleKeys;
    if (keys.has(entry.ruleKey)) return null;
    keys.add(entry.ruleKey);
    const { ruleKey: _key, ...rest } = entry;
    return this.addOutbox(session, rest);
  }

  async claimTelegramDeletion(session: string, businessId: string, entryId: string): Promise<OutboxEntry | null> {
    const outbox = this.peek(session)?.outbox ?? [];
    const index = outbox.findIndex((entry) => entry.id === entryId && entry.businessId === businessId && entry.channel === "telegram" && entry.delivery === "sent" && entry.deletionState !== "deleting" && entry.deletionState !== "deleted");
    const entry = outbox[index];
    if (entry === undefined) return null;
    const claimed: OutboxEntry = { ...entry, deletionState: "deleting" };
    outbox[index] = claimed;
    return claimed;
  }

  async claimOutbox(session: string, entryId: string): Promise<OutboxEntry | null> {
    // Check and write happen with no await between them, so a second sender finds it already sending.
    const outbox = this.peek(session)?.outbox ?? [];
    const index = outbox.findIndex((entry) => entry.id === entryId && entry.delivery === "queued");
    const entry = outbox[index];
    if (entry === undefined) return null;
    const claimed: OutboxEntry = { ...entry, delivery: "sending" };
    outbox[index] = claimed;
    return claimed;
  }

  async settleOutbox(session: string, entryId: string, patch: OutboxPatch): Promise<void> {
    const outbox = this.peek(session)?.outbox ?? [];
    const index = outbox.findIndex((entry) => entry.id === entryId);
    const entry = outbox[index];
    if (entry === undefined) throw new NotFoundError(`Outbox entry ${entryId} not found in this session.`);
    outbox[index] = { ...entry, ...patch, delivery: patch.delivery, note: patch.note === undefined ? entry.note : patch.note, sentAt: patch.sentAt ?? entry.sentAt };
  }

  async listDueOutbox(now: string, limit: number): Promise<{ readonly session: string; readonly entry: OutboxEntry }[]> {
    const due = [...this.sessions.entries()].flatMap(([session, data]) =>
      data.outbox.filter((entry) => entry.delivery === "queued" && entry.sentAt <= now).map((entry) => ({ session, entry })),
    );
    return due.sort((a, b) => a.entry.sentAt.localeCompare(b.entry.sentAt)).slice(0, limit);
  }

  async listContacts(session: string, businessId: string): Promise<Contact[]> {
    return [...(this.peek(session)?.contacts.values() ?? [])].filter((contact) => contact.businessId === businessId);
  }

  async saveContact(session: string, contact: NewContact): Promise<Contact> {
    const contacts = this.data(session).contacts;
    // One contact per phone number and per Telegram chat: a second save for either updates the first.
    const samePhone = contact.phone === null ? undefined : [...contacts.values()].find((c) => c.businessId === contact.businessId && c.phone === contact.phone);
    const sameChat = contact.telegramChatId === undefined ? undefined : [...contacts.values()].find((c) => c.businessId === contact.businessId && c.telegramChatId === contact.telegramChatId);
    const id = contact.id ?? samePhone?.id ?? sameChat?.id ?? randomUUID();
    for (const duplicate of [samePhone, sameChat]) {
      if (duplicate !== undefined && duplicate.id !== id) contacts.delete(duplicate.id);
    }
    const saved: Contact = { ...contact, id };
    contacts.set(id, saved);
    return saved;
  }

  async deleteContact(session: string, businessId: string, contactId: string): Promise<void> {
    const contacts = this.peek(session)?.contacts;
    if (contacts?.get(contactId)?.businessId === businessId) contacts.delete(contactId);
  }

  async listConnections(session: string, businessId: string): Promise<StoredConnection[]> {
    return [...(this.peek(session)?.connections.values() ?? [])].filter((connection) => connection.businessId === businessId);
  }

  async saveConnection(session: string, connection: NewConnection): Promise<StoredConnection> {
    const connections = this.data(session).connections;
    await this.deleteConnection(session, connection.businessId, connection.kind);
    const saved: StoredConnection = { ...connection, id: randomUUID(), createdAt: new Date().toISOString() };
    connections.set(saved.id, saved);
    return saved;
  }

  async deleteConnection(session: string, businessId: string, kind: ConnectionKind): Promise<void> {
    const connections = this.peek(session)?.connections;
    for (const [id, connection] of connections ?? []) {
      if (connection.businessId === businessId && connection.kind === kind) connections?.delete(id);
    }
  }

  async findConnection(hookId: string): Promise<{ readonly session: string; readonly connection: StoredConnection } | null> {
    for (const [session, data] of this.sessions) {
      for (const connection of data.connections.values()) {
        if (connection.hookId === hookId) return { session, connection };
      }
    }
    return null;
  }

  async listOutbox(session: string, businessId: string): Promise<OutboxEntry[]> {
    // Newest first, as `SupabaseStore` orders it.
    return (this.peek(session)?.outbox ?? []).filter((entry) => entry.businessId === businessId).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  async recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    this.data(session).events.push({ id: randomUUID(), businessId, source, payload, receivedAt: new Date().toISOString() });
  }

  async listEvents(session: string, businessId: string, since?: string): Promise<StoredEvent[]> {
    return (this.peek(session)?.events ?? []).filter((event) => event.businessId === businessId && (since === undefined || event.receivedAt > since)).map((event) => ({ ...event }));
  }

  async listMessages(session: string, thread: ChatThread, limit: number): Promise<ChatMessage[]> {
    return (this.peek(session)?.threads.get(threadKey(thread)) ?? []).slice(-limit);
  }

  async addMessages(session: string, thread: ChatThread, messages: readonly NewChatMessage[]): Promise<ChatMessage[]> {
    const threads = this.data(session).threads;
    const at = new Date().toISOString();
    const saved = messages.map((message) => ({ ...message, id: randomUUID(), at }));
    threads.set(threadKey(thread), [...(threads.get(threadKey(thread)) ?? []), ...saved]);
    return saved;
  }

  async getIntake(session: string, id: string): Promise<IntakeRecord | null> {
    return this.peek(session)?.intakes.get(id) ?? null;
  }

  async saveIntake(session: string, intake: IntakeRecord): Promise<void> {
    this.data(session).intakes.set(intake.id, intake);
  }

  async telegramHook(session: string, businessId: string, candidate: string): Promise<string> {
    const data = this.peek(session);
    if (data === undefined || !data.businesses.has(businessId)) throw new NotFoundError(`Business ${businessId} not found in this session.`);
    const saved = data.telegramHooks.get(businessId);
    if (saved !== undefined) return saved;
    data.telegramHooks.set(businessId, candidate);
    return candidate;
  }

  async findTelegramHook(hookId: string): Promise<{ readonly session: string; readonly businessId: string } | null> {
    for (const [session, data] of this.sessions) {
      for (const [businessId, saved] of data.telegramHooks) {
        if (saved === hookId) return { session, businessId };
      }
    }
    return null;
  }

  async findTelegramChat(chatId: string): Promise<TelegramChat | null> {
    const chat = this.telegramChats.get(chatId);
    // A binding outlives nothing: once its session is evicted or reset, the chat is unbound.
    return chat !== undefined && this.sessions.has(chat.session) ? chat : null;
  }

  async bindTelegramChat(session: string, chat: NewTelegramChat): Promise<TelegramChat> {
    // Touch the session, so the binding lives exactly as long as the session's other data.
    this.data(session);
    const saved: TelegramChat = { ...chat, session, blockedAt: null };
    this.telegramChats.set(chat.chatId, saved);
    return saved;
  }

  async setTelegramChatBlocked(chatId: string, at: string | null): Promise<void> {
    const chat = this.telegramChats.get(chatId);
    if (chat !== undefined) this.telegramChats.set(chatId, { ...chat, blockedAt: at });
  }

  async telegramUpdateDone(updateId: number): Promise<boolean> {
    return this.telegramUpdates.get(updateId)?.status === "done";
  }

  async claimTelegramUpdate(updateId: number, now: string, retakeAfterMs: number): Promise<boolean> {
    // Check and write happen with no await between them, so two deliveries of one update can't both claim it.
    const claim = this.telegramUpdates.get(updateId);
    const stale = claim !== undefined && claim.status === "claimed" && Date.parse(claim.claimedAt) <= Date.parse(now) - retakeAfterMs;
    if (claim !== undefined && claim.status !== "failed" && !stale) return false;
    this.telegramUpdates.set(updateId, { status: "claimed", claimedAt: now });
    return true;
  }

  async finishTelegramUpdate(updateId: number, status: "done" | "failed"): Promise<void> {
    const claim = this.telegramUpdates.get(updateId);
    if (claim !== undefined) claim.status = status;
  }

  async addThreadMessage(session: string, message: NewThreadMessage): Promise<ThreadMessage> {
    const saved: ThreadMessage = { ...message, id: randomUUID() };
    this.data(session).threadMessages.push(saved);
    return saved;
  }

  async listThreadMessages(session: string, businessId: string, contactId: string, limit: number): Promise<ThreadMessage[]> {
    const thread = (this.peek(session)?.threadMessages ?? []).filter((message) => message.businessId === businessId && message.contactId === contactId);
    return inOrder(thread).slice(-limit);
  }

  async getConversationOwner(session: string, businessId: string, contactId: string): Promise<ConversationOwner> {
    return this.peek(session)?.conversationOwners.get(`${businessId}:${contactId}`) ?? "frontdesk";
  }

  async setConversationOwner(session: string, businessId: string, contactId: string, owner: ConversationOwner, _at: string): Promise<void> {
    this.data(session).conversationOwners.set(`${businessId}:${contactId}`, owner);
  }

  async getStandingRules(session: string, businessId: string): Promise<StandingRuleState[]> {
    return [...(this.peek(session)?.rules.entries() ?? [])].filter(([key]) => key.startsWith(`${businessId}:`)).map(([, state]) => state);
  }

  async setStandingRule(session: string, businessId: string, rule: StandingRuleId, enabled: boolean, at: string): Promise<StandingRuleState> {
    const rules = this.data(session).rules;
    const before = rules.get(`${businessId}:${rule}`) ?? defaultRuleState(rule);
    const saved: StandingRuleState = { rule, enabled, approvedAt: enabled ? at : before.approvedAt, changedAt: at };
    rules.set(`${businessId}:${rule}`, saved);
    return saved;
  }

  async getBriefState(session: string, businessId: string): Promise<BriefState | null> {
    return this.peek(session)?.briefs.get(businessId) ?? null;
  }

  async claimBriefRun(session: string, businessId: string, now: string, retakeAfterMs: number): Promise<boolean> {
    // Check and write happen with no await between them, so two runs can't both start.
    const briefs = this.data(session).briefs;
    const state = briefs.get(businessId) ?? { runningSince: null, lastSuccessAt: null, lastCardKey: null, lastSnapshot: null };
    if (state.runningSince !== null && Date.parse(state.runningSince) > Date.parse(now) - retakeAfterMs) return false;
    briefs.set(businessId, { ...state, runningSince: now });
    return true;
  }

  async finishBriefRun(session: string, businessId: string, result: BriefRunResult): Promise<void> {
    const briefs = this.data(session).briefs;
    const state = briefs.get(businessId) ?? { runningSince: null, lastSuccessAt: null, lastCardKey: null, lastSnapshot: null };
    briefs.set(businessId, result.ok ? { runningSince: null, lastSuccessAt: result.at, lastCardKey: result.cardKey, lastSnapshot: result.snapshot } : { ...state, runningSince: null });
  }

  async listBriefTargets(limit: number): Promise<{ readonly session: string; readonly businessId: string }[]> {
    return [...this.sessions].flatMap(([session, data]) => [...data.businesses.keys()].map((businessId) => ({ session, businessId }))).slice(0, limit);
  }

  async findIntakeByBusiness(session: string, businessId: string): Promise<IntakeRecord | null> {
    return [...(this.peek(session)?.intakes.values() ?? [])].find((intake) => intake.businessId === businessId) ?? null;
  }

  async savePhoto(session: string, businessId: string, data: Uint8Array, contentType: string): Promise<StoredPhoto> {
    const photos = this.data(session).photos;
    if (photos.size >= MAX_PHOTOS_PER_SESSION) {
      const oldest = photos.keys().next().value;
      if (oldest !== undefined) photos.delete(oldest);
    }
    const photo = { id: randomUUID(), businessId, contentType, size: data.byteLength };
    photos.set(photo.id, { ...photo, data: data.slice() });
    return photo;
  }

  async getPhoto(session: string, businessId: string, photoId: string): Promise<PhotoFile | null> {
    const photo = this.peek(session)?.photos.get(photoId);
    return photo && photo.businessId === businessId ? { contentType: photo.contentType, data: photo.data } : null;
  }

  async photoExists(session: string, businessId: string, photoId: string): Promise<boolean> {
    return this.peek(session)?.photos.get(photoId)?.businessId === businessId;
  }

  async listPostPlaybook(niche: TradeKey): Promise<PostPlaybook> {
    return playbookForNiche(PLAYBOOK_SEED, niche);
  }

  async reset(session: string): Promise<void> {
    this.sessions.delete(session);
    for (const [chatId, chat] of this.telegramChats) {
      if (chat.session === session) this.telegramChats.delete(chatId);
    }
  }
}
