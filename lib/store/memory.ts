import { randomUUID } from "node:crypto";
import type { CardRecord, ChatMessage, OutboxEntry } from "@/lib/api/contract";
import type { ConnectionKind } from "@/lib/domain/connections";
import type { Contact } from "@/lib/domain/contacts";
import type { BusinessProfile, Choice, ChoiceMap, KeyedCard, ProfileChangeSource, WorkflowId } from "@/lib/domain/types";
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
  type ProfileVersion,
  type Store,
  type StoredConnection,
} from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `MemoryStore` keeps every session's data in process memory. It lets local
// development and CI run with no Supabase keys. Data lives only as long as the server process, and
// each serverless instance has its own copy, so production uses `SupabaseStore`.

interface SessionData {
  readonly businesses: Map<string, BusinessProfile>;
  readonly choices: Map<string, Map<WorkflowId, Choice>>;
  readonly cards: Map<string, CardRecord>;
  readonly outbox: OutboxEntry[];
  readonly contacts: Map<string, Contact>;
  readonly connections: Map<string, StoredConnection>;
  readonly events: { businessId: string; source: string; payload: Readonly<Record<string, unknown>>; receivedAt: string }[];
  /** Chat messages by thread, keyed `${kind}:${id}`. */
  readonly threads: Map<string, ChatMessage[]>;
  readonly intakes: Map<string, IntakeRecord>;
  /** Saved profile versions by business id, oldest first. */
  readonly versions: Map<string, ProfileVersion[]>;
}

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

  /** Return the session's data for a write, creating it on first use and evicting the oldest past `MAX_SESSIONS`. */
  private data(session: string): SessionData {
    let found = this.sessions.get(session);
    if (!found) {
      // Bound memory: a server can see many sessions, and on memory each one only needs to last a visit.
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = this.sessions.keys().next().value;
        if (oldest !== undefined) this.sessions.delete(oldest);
      }
      found = { businesses: new Map(), choices: new Map(), cards: new Map(), outbox: [], contacts: new Map(), connections: new Map(), events: [], threads: new Map(), intakes: new Map(), versions: new Map() };
      this.sessions.set(session, found);
    }
    return found;
  }

  /** Return the session's data for a read, without creating an entry for a visitor who has stored nothing. */
  private peek(session: string): SessionData | undefined {
    return this.sessions.get(session);
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
    outbox[index] = { ...entry, delivery: patch.delivery, note: patch.note === undefined ? entry.note : patch.note, sentAt: patch.sentAt ?? entry.sentAt };
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
    // One contact per phone number: a second save for the same number updates the first.
    const samePhone = contact.phone === null ? undefined : [...contacts.values()].find((c) => c.businessId === contact.businessId && c.phone === contact.phone);
    const id = contact.id ?? samePhone?.id ?? randomUUID();
    if (samePhone !== undefined && samePhone.id !== id) contacts.delete(samePhone.id);
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
    return (this.peek(session)?.outbox ?? []).filter((entry) => entry.businessId === businessId);
  }

  async recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    this.data(session).events.push({ businessId, source, payload, receivedAt: new Date().toISOString() });
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

  async reset(session: string): Promise<void> {
    this.sessions.delete(session);
  }
}
