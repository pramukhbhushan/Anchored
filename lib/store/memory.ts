import { randomBytes, randomUUID } from "node:crypto";
import type { CardRecord, ChatMessage, OutboxEntry } from "@/lib/api/contract";
import type { BusinessProfile, Choice, ChoiceMap, KeyedCard, ProfileChangeSource, WorkflowId } from "@/lib/domain/types";
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
// `MemoryStore` keeps every session's data in process memory. It lets local
// development and CI run with no Supabase keys. Data lives only as long as the server process, and
// each serverless instance has its own copy, so production uses `SupabaseStore`.
// Channel links and conversations sit outside the sessions because the Telegram
// webhook looks them up by code or chat; each one names its session, and leaves with it.

interface SessionData {
  readonly businesses: Map<string, BusinessProfile>;
  readonly choices: Map<string, Map<WorkflowId, Choice>>;
  readonly cards: Map<string, CardRecord>;
  readonly outbox: OutboxEntry[];
  readonly events: { businessId: string; source: string; payload: Readonly<Record<string, unknown>>; receivedAt: string }[];
  /** Chat messages by thread, keyed `${kind}:${id}`. */
  readonly threads: Map<string, ChatMessage[]>;
  readonly intakes: Map<string, IntakeRecord>;
  /** Saved profile versions by business id, oldest first. */
  readonly versions: Map<string, ProfileVersion[]>;
}

/** A channel link code's target. */
interface LinkTarget {
  readonly session: string;
  readonly businessId: string;
  readonly channel: ConversationChannel;
}

function conversationKey(channel: ConversationChannel, contact: string): string {
  return `${channel}:${contact}`;
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
  /** Link codes, deployment-wide. */
  private readonly links = new Map<string, LinkTarget>();
  /** Conversations by `${channel}:${contact}`, deployment-wide, since one chat is bound to one business. */
  private readonly conversations = new Map<string, Owned<Conversation>>();

  /** Return the session's data for a write, creating it on first use and evicting the oldest past `MAX_SESSIONS`. */
  private data(session: string): SessionData {
    let found = this.sessions.get(session);
    if (!found) {
      // Bound memory: a server can see many sessions, and on memory each one only needs to last a visit.
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = this.sessions.keys().next().value;
        if (oldest !== undefined) this.dropSession(oldest);
      }
      found = { businesses: new Map(), choices: new Map(), cards: new Map(), outbox: [], events: [], threads: new Map(), intakes: new Map(), versions: new Map() };
      this.sessions.set(session, found);
    }
    return found;
  }

  /** Forget a session and every link and conversation that belongs to it. */
  private dropSession(session: string): void {
    this.sessions.delete(session);
    for (const [code, link] of this.links) if (link.session === session) this.links.delete(code);
    for (const [key, owned] of this.conversations) if (owned.session === session) this.conversations.delete(key);
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
    const saved: OutboxEntry = { ...entry, id: randomUUID(), sentAt: entry.sentAt ?? new Date().toISOString() };
    this.data(session).outbox.push(saved);
    return saved;
  }

  async listOutbox(session: string, businessId: string): Promise<OutboxEntry[]> {
    return (this.peek(session)?.outbox ?? []).filter((entry) => entry.businessId === businessId);
  }

  async markDelivered(session: string, outboxId: string, result: DeliveryResult): Promise<void> {
    const outbox = this.peek(session)?.outbox;
    const index = outbox?.findIndex((entry) => entry.id === outboxId) ?? -1;
    const entry = outbox?.[index];
    if (!outbox || !entry) throw new NotFoundError(`Outbox entry ${outboxId} not found in this session.`);
    outbox[index] = "error" in result ? { ...entry, deliveryError: result.error } : { ...entry, deliveredAt: result.deliveredAt };
  }

  async listUndelivered(now: Date, limit: number): Promise<Owned<OutboxEntry>[]> {
    const due: Owned<OutboxEntry>[] = [];
    for (const [session, data] of this.sessions) {
      for (const entry of data.outbox) {
        const waiting = entry.channel === "telegram" && entry.deliveredAt === undefined && entry.deliveryError === undefined;
        if (waiting && Date.parse(entry.sentAt) <= now.getTime()) due.push({ session, value: entry });
      }
    }
    return due.sort((a, b) => a.value.sentAt.localeCompare(b.value.sentAt)).slice(0, limit);
  }

  async ensureChannelLink(session: string, businessId: string, channel: ConversationChannel): Promise<string> {
    for (const [code, link] of this.links) {
      if (link.session === session && link.businessId === businessId && link.channel === channel) return code;
    }
    // Make sure the session exists, so eviction later takes its links with it.
    this.data(session);
    const code = randomBytes(16).toString("base64url");
    this.links.set(code, { session, businessId, channel });
    return code;
  }

  async resolveChannelLink(code: string): Promise<Owned<{ businessId: string; channel: ConversationChannel }> | null> {
    const link = this.links.get(code);
    return link ? { session: link.session, value: { businessId: link.businessId, channel: link.channel } } : null;
  }

  async getConversation(session: string, channel: ConversationChannel, contact: string): Promise<Conversation | null> {
    const owned = this.conversations.get(conversationKey(channel, contact));
    return owned?.session === session ? owned.value : null;
  }

  async bindConversation(session: string, conversation: Conversation): Promise<void> {
    this.data(session);
    this.conversations.set(conversationKey(conversation.channel, conversation.contact), { session, value: conversation });
  }

  async updateConversation(session: string, channel: ConversationChannel, contact: string, patch: ConversationPatch): Promise<Conversation | null> {
    const key = conversationKey(channel, contact);
    const owned = this.conversations.get(key);
    if (owned?.session !== session) return null;
    const value: Conversation = { ...owned.value, ...patch, updatedAt: new Date().toISOString() };
    this.conversations.set(key, { session, value });
    return value;
  }

  async findConversation(channel: ConversationChannel, contact: string): Promise<Owned<Conversation> | null> {
    return this.conversations.get(conversationKey(channel, contact)) ?? null;
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
    this.dropSession(session);
  }
}
