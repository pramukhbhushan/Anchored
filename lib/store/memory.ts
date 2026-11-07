import { randomUUID } from "node:crypto";
import type { CardRecord, OutboxEntry } from "@/lib/api/contract";
import type { BusinessProfile, Choice, ChoiceMap, KeyedCard, WorkflowId } from "@/lib/domain/types";
import { NotFoundError, type CardPatch, type NewOutboxEntry, type Store } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `MemoryStore` keeps every session's data in process memory. It lets the demo
// run with no Supabase keys. Data lives only as long as the server process, and
// each serverless instance has its own copy, so production uses `SupabaseStore`.

interface SessionData {
  readonly businesses: Map<string, BusinessProfile>;
  readonly choices: Map<string, Map<WorkflowId, Choice>>;
  readonly cards: Map<string, CardRecord>;
  readonly outbox: OutboxEntry[];
  readonly events: { businessId: string; source: string; payload: Readonly<Record<string, unknown>>; receivedAt: string }[];
}

/** In-process `Store` for local runs and keyless demos. */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private readonly sessions = new Map<string, SessionData>();

  private data(session: string): SessionData {
    let found = this.sessions.get(session);
    if (!found) {
      found = { businesses: new Map(), choices: new Map(), cards: new Map(), outbox: [], events: [] };
      this.sessions.set(session, found);
    }
    return found;
  }

  async listBusinesses(session: string): Promise<BusinessProfile[]> {
    return [...this.data(session).businesses.values()];
  }

  async getBusiness(session: string, id: string): Promise<BusinessProfile | null> {
    return this.data(session).businesses.get(id) ?? null;
  }

  async saveBusiness(session: string, business: BusinessProfile): Promise<void> {
    this.data(session).businesses.set(business.id, business);
  }

  async getChoices(session: string, businessId: string): Promise<ChoiceMap> {
    return Object.fromEntries(this.data(session).choices.get(businessId) ?? []);
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
    return [...this.data(session).cards.values()].filter((card) => card.businessId === businessId);
  }

  async getCard(session: string, cardId: string): Promise<CardRecord | null> {
    return this.data(session).cards.get(cardId) ?? null;
  }

  async updateCard(session: string, cardId: string, patch: CardPatch): Promise<CardRecord> {
    const cards = this.data(session).cards;
    const card = cards.get(cardId);
    if (!card) throw new NotFoundError(`Card ${cardId} not found in this session.`);
    const updated: CardRecord = { ...card, ...patch };
    cards.set(cardId, updated);
    return updated;
  }

  async addOutbox(session: string, entry: NewOutboxEntry): Promise<OutboxEntry> {
    const saved: OutboxEntry = { ...entry, id: randomUUID(), sentAt: entry.sentAt ?? new Date().toISOString() };
    this.data(session).outbox.push(saved);
    return saved;
  }

  async listOutbox(session: string, businessId: string): Promise<OutboxEntry[]> {
    return this.data(session).outbox.filter((entry) => entry.businessId === businessId);
  }

  async recordEvent(session: string, businessId: string, source: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    this.data(session).events.push({ businessId, source, payload, receivedAt: new Date().toISOString() });
  }

  async reset(session: string): Promise<void> {
    this.sessions.delete(session);
  }
}
