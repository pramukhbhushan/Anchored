import type { CardRecord } from "@/lib/api/contract";
import type { ActiveAgent } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Synthetic examples for presentation tests only. Application pages never
// import these records, so failed reads cannot turn into fictional customer
// messages, approvals or financial results.

export const FRONT_DESK_FIXTURE: ActiveAgent = {
  id: "frontdesk",
  name: "Front Desk",
  job: "Answers first contact",
  skills: ["inquiry", "showup"],
  niche: false,
  approval: "every-card",
};

export const FOLLOW_UP_FIXTURE: ActiveAgent = {
  id: "followup",
  name: "Follow-up",
  job: "Follows up on quotes",
  skills: ["closer", "inquiry"],
  niche: false,
  approval: "every-card",
};

export const NICHE_AGENT_FIXTURE: ActiveAgent = {
  id: "niche:stock-check",
  name: "Stock Check",
  job: "Checks the owner's stock list",
  skills: ["stockcheck"],
  niche: true,
  approval: "every-card",
};

export const ACTIVE_AGENT_FIXTURES: readonly ActiveAgent[] = [
  FRONT_DESK_FIXTURE,
  FOLLOW_UP_FIXTURE,
  { id: "books", name: "Bookkeeping", job: "Watches unpaid invoices", skills: ["nudger"], niche: false, approval: "every-card" },
  { id: "content", name: "Marketing", job: "Drafts posts", skills: ["posts"], niche: false, approval: "every-card" },
  { id: "internal", name: "Internal Communications", job: "Keeps the owner briefed", skills: ["brief", "triage"], niche: false, approval: "every-card" },
  NICHE_AGENT_FIXTURE,
];

export const PENDING_CARD_FIXTURE: CardRecord = {
  id: "example-inquiry",
  key: "example-business:inquiry",
  businessId: "example-business",
  agent: "frontdesk",
  skill: "inquiry",
  title: "Inquiry from Sam",
  body: "Thanks for reaching out. What can we help with?",
  reason: "Sam asked about the business",
  checks: ["Draft waits for the owner's approval"],
  action: "Send email",
  channel: "email",
  to: "sam@example.com",
  example: true,
  status: "pending",
  edited: false,
  createdAt: "2026-11-08T15:00:00.000Z",
  decidedAt: null,
};

export const CARD_FIXTURES: readonly CardRecord[] = [
  PENDING_CARD_FIXTURE,
  { ...PENDING_CARD_FIXTURE, id: "duplicate-inquiry" },
  { ...PENDING_CARD_FIXTURE, id: "example-closer", key: "example-business:closer", agent: "followup", skill: "closer", status: "approved", decidedAt: "2026-11-08T15:02:00.000Z" },
  { ...PENDING_CARD_FIXTURE, id: "example-skipped", key: "example-business:skipped", status: "skipped", decidedAt: "2026-11-08T15:03:00.000Z" },
  { ...PENDING_CARD_FIXTURE, id: "example-superseded", key: "example-business:replaced", status: "superseded", decidedAt: "2026-11-08T15:04:00.000Z" },
  { ...PENDING_CARD_FIXTURE, id: "example-owner-note", key: "example-business:note", agent: null, skill: null, channel: "list" },
  { ...PENDING_CARD_FIXTURE, id: "example-stock", key: "example-business:stock", agent: "niche:stock-check", skill: "stockcheck", channel: "list" },
];
