import { z } from "zod";
import type { Contact } from "@/lib/domain/contacts";
import { OPT_OUT_LINE, QUIET_HOURS_RULE } from "@/lib/domain/executor";
import type { CardDraft, SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Follow-up timers run from facts an owner recorded, never dates or job states
// guessed from a customer's message. Each timer creates at most one draft for
// that customer, skill and due day. A customer's draft is a text to their
// number on file, which needs a texting OK, and the owner still approves every
// message. Debrief stays an owner note. A payment alone doesn't count as a
// completed job.

/** Customer skills with a recorded-fact timer. */
export const FOLLOWUP_SKILLS = ["callback", "closer", "callfollow", "reactivator", "keeper", "referral", "debrief", "showup", "reviewer"] as const;
export type FollowupSkill = (typeof FOLLOWUP_SKILLS)[number];

/** The job or customer states a timer can rest on. */
const RECORDED_STATES = ["missed-call", "open-quote", "completed-call", "inactive-customer", "membership-due", "completed-job", "booking"] as const;

/** The state a timer must have on record before its skill may draft work. */
export const FOLLOWUP_STATES = {
  callback: "missed-call",
  closer: "open-quote",
  callfollow: "completed-call",
  reactivator: "inactive-customer",
  keeper: "membership-due",
  referral: "completed-job",
  debrief: "completed-call",
  showup: "booking",
  reviewer: "completed-job",
} as const satisfies Readonly<Record<FollowupSkill, (typeof RECORDED_STATES)[number]>>;

/** An owner's scheduling input. An explicit offset avoids guessing a local time during a DST transition. */
export const followupInputSchema = z.object({
  contactId: z.string().trim().min(1).max(100),
  skill: z.enum(FOLLOWUP_SKILLS),
  dueAt: z.iso.datetime({ offset: true }),
  state: z.enum(RECORDED_STATES),
  sourceId: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_.:-]+$/, "Use the recorded quote, call or job reference."),
  evidence: z.string().trim().min(1, "Record where this fact came from.").max(1000),
}).strict().superRefine((value, context) => {
  if (value.state !== FOLLOWUP_STATES[value.skill]) {
    context.addIssue({ code: "custom", path: ["state"], message: "This follow-up needs the matching job or customer state on record." });
  }
});

export type FollowupInput = z.infer<typeof followupInputSchema>;

/** A stored timer. Canceling it keeps its evidence for the owner. */
export interface RecordedFollowup extends FollowupInput {
  readonly id: string;
  readonly businessId: string;
  readonly status: "active" | "cancelled";
}

/** What a due timer needs from current, session-scoped business reads. */
export interface FollowupContext {
  readonly now: Date;
  readonly chosen: ReadonlySet<SkillId>;
  readonly contact: Contact | null;
  readonly locked: boolean;
  readonly businessName: string;
  /** Prior approved touches for this contact, skill and source. The current draft is excluded. */
  readonly previousTouches?: number;
}

/** A draft built from recorded facts, before the server assigns its core or niche agent. */
export interface FollowupDraft extends Omit<CardDraft, "agent"> {
  readonly key: string;
  readonly skill: FollowupSkill;
  readonly contactId: string;
}

const COPY: Readonly<Record<FollowupSkill, { readonly title: string; readonly body: string }>> = {
  callback: { title: "Check in after a missed call", body: "Sorry we missed your call. What would you like help with?" },
  closer: { title: "Follow up on an open quote", body: "Checking in on the quote we sent. Do you have any questions before deciding?" },
  callfollow: { title: "Check in after a call", body: "Thanks for talking with us. Have you had a chance to think it over? Let us know if you have questions." },
  reactivator: { title: "Check in with a past customer", body: "It's been a while since we last heard from you. Is there anything we can help with?" },
  keeper: { title: "Check a plan renewal", body: "Your plan is coming up for renewal. Would you like to talk through the next step?" },
  referral: { title: "Ask for a referral", body: "Thanks for choosing us. If someone you know could use our help, we'd appreciate an introduction." },
  debrief: { title: "Review the recorded call notes", body: "Read the recorded call notes and decide the next step. No customer message has been drafted." },
  showup: { title: "Remind a customer about a booking", body: "A quick reminder about your booking with us. Please let us know if your plans have changed." },
  reviewer: { title: "Ask about a finished job", body: "Thanks for choosing us. If you'd like to share your experience, we'd appreciate an honest review." },
};

/** Return one safe, due draft, or nothing when its current facts no longer permit it. */
export function dueFollowup(record: RecordedFollowup, context: FollowupContext): FollowupDraft | null {
  const parsed = followupInputSchema.safeParse({ contactId: record.contactId, skill: record.skill, dueAt: record.dueAt, state: record.state, sourceId: record.sourceId, evidence: record.evidence });
  if (!parsed.success || record.status !== "active" || !Number.isFinite(context.now.getTime())) return null;
  const due = new Date(parsed.data.dueAt);
  if (due.getTime() > context.now.getTime() || !context.chosen.has(record.skill) || context.locked) return null;
  const previousTouches = context.previousTouches ?? 0;
  if ((record.skill === "closer" || record.skill === "callfollow") && (!Number.isInteger(previousTouches) || previousTouches < 0 || previousTouches >= 3)) return null;
  const contact = context.contact;
  if (contact === null || contact.id !== record.contactId || contact.businessId !== record.businessId || contact.optedOutAt !== null) return null;
  const ownerOnly = record.skill === "debrief";
  if (!ownerOnly && (contact.phone === null || contact.consent === null)) return null;
  const copy = COPY[record.skill];
  return {
    // A second record for the same customer and due day must not produce another draft.
    key: `${record.businessId}:followup:${record.contactId}:${record.skill}:${record.sourceId}:${due.toISOString().slice(0, 10)}`,
    skill: record.skill,
    contactId: contact.id,
    title: `${copy.title}: ${contact.name}`,
    body: ownerOnly ? copy.body : `${context.businessName}: ${copy.body} ${OPT_OUT_LINE}`,
    reason: `You recorded this follow-up and its due time. Source: ${parsed.data.evidence}`,
    checks: ["Due time and job state recorded by you", "No price or open time guessed", ...(ownerOnly ? ["Nothing sent to the customer"] : [QUIET_HOURS_RULE, "Waiting for your approval"])],
    action: ownerOnly ? "Mark read" : "Send text",
    channel: ownerOnly ? "flag" : "sms",
    // A text goes to the number on file, so the sender can match it to this customer's texting OK and any STOP.
    ...(ownerOnly ? { to: contact.name } : { contact: contact.id, to: contact.phone ?? contact.name }),
  };
}
