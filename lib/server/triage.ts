import "server-only";
import { randomUUID } from "node:crypto";
import { SKILLS } from "@/lib/domain/agents";
import { liveEventKey } from "@/lib/domain/cards";
import { agentForSkill, chosenSkills, resolveChoices } from "@/lib/domain/paths";
import { classifyEmail, routeEmail, type EmailKind } from "@/lib/domain/triage";
import type { BusinessProfile, KeyedCard, SkillId } from "@/lib/domain/types";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Inbox Triage for an email the owner forwarded to their Anchored address.
// Code sorts it (`classifyEmail`) and files one card under the agent whose work
// it is, or under Inbox Triage for the owner when the business has no such
// agent. The card holds the email's words and sends nothing: no automatic
// reply, no customer thread, and no amount read out of the email. Postmark's
// message id keys the card, so an email delivered twice makes one card.

/** A forwarded email as the webhook read it. */
export interface TriageEmail {
  readonly from: string;
  readonly fromName: string | null;
  readonly subject: string;
  readonly text: string;
  readonly messageId: string | null;
}

/** Sort one forwarded email into a card and return its key. Repeats of the same email return the first card's key. */
export async function triageEmail(session: string, business: BusinessProfile, email: TriageEmail): Promise<string> {
  const store = getStore();
  const key = liveEventKey(business.id, `email-${email.messageId ?? randomUUID()}`);
  const [cards, saved] = await Promise.all([store.listCards(session, business.id), store.getChoices(session, business.id)]);
  if (cards.some((card) => card.key === key)) return key;
  const kind = classifyEmail(email);
  const route = routeEmail(kind, new Set<SkillId>(chosenSkills(business, resolveChoices(business, saved))));
  await store.recordEvent(session, business.id, "email", { kind, subject: email.subject, ...(email.messageId === null ? {} : { messageId: email.messageId }) });
  await store.ensureCards(session, business.id, [{ ...emailCard(business, email, kind, route.skill), key }]);
  return key;
}

// What each kind of email is, in a card title's words.
const KIND_TITLE: Readonly<Record<EmailKind, string>> = {
  customer: "Customer email",
  billing: "Billing email",
  supplier: "Supplier email",
  review: "Review notice",
  unknown: "Forwarded email",
};

// What the receiving agent does with each kind, while the handoffs to Bookkeeping and Marketing are still to come.
const KIND_NEXT: Readonly<Record<EmailKind, string>> = {
  customer: "Forwarded emails stay one card each, so reply to them from your own email.",
  billing: "Anchored states no amount it didn't read from Stripe, so check this against your invoices before you reply.",
  supplier: "Compare it with your last invoice. Anchored doesn't read prices out of forwarded email yet.",
  review: "Paste the review into Chat to get a reply drafted for you to approve.",
  unknown: "Anchored couldn't tell whose work this is.",
};

/** The card for one forwarded email, filed under `skill`, or under Inbox Triage for the owner when it's `null`. */
function emailCard(business: BusinessProfile, email: TriageEmail, kind: EmailKind, skill: SkillId | null): Omit<KeyedCard, "key"> {
  const filed = skill ?? "triage";
  const sender = (email.fromName ? `${email.fromName} <${email.from}>` : email.from).slice(0, 120);
  const owner = skill === null ? (kind === "unknown" ? "It's yours to read." : `None of your agents handles this kind of email, so it's yours to read.`) : `This is ${SKILLS[skill].name}'s work.`;
  return {
    agent: agentForSkill(business, filed),
    skill: filed,
    title: `${KIND_TITLE[kind]} from ${sender}: ${email.subject}`.slice(0, 160),
    body: email.text.trim() === "" ? "The email had no text." : email.text.trim().slice(0, 600),
    reason: `${owner} ${KIND_NEXT[kind]}`,
    checks: ["Read from an email you forwarded", "No reply sent to anyone"],
    action: "Add it to your list",
    channel: "list",
  };
}
