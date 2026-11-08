import type { SkillId, TradeKey, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's words for the Workflows graph and the bill. `SKILL_STEPS` says what
// starts each agent job, what it drafts for the owner's OK and what comes of
// it; `TOOL_STEPS` says the same for a tool covering a workflow. No skill,
// path or model names appear here; those stay under the hood.

/** One kind of work from start to finish, as an owner would tell it. */
export interface WorkSteps {
  /** What sets the work off, as a full sentence with its subject: "A customer calls and nobody picks up". */
  readonly trigger: string;
  /** What lands in front of the owner: the draft an agent writes. */
  readonly draft: string;
  /** What the owner gets when it works. */
  readonly result: string;
}

/** What a tool does for the owner, plus what starts the work and what comes of it. */
export interface ToolSteps {
  readonly trigger: string;
  /** What the tool does, as a verb phrase: "Answers the phone for you". */
  readonly does: string;
  readonly result: string;
}

/** Each agent job in the owner's words. `brief` and `triage` run for everyone and stay off the Workflows graph. */
export const SKILL_STEPS: Readonly<Record<SkillId, WorkSteps>> = {
  callback: {
    trigger: "A customer calls and nobody picks up",
    draft: "A text back with two open times",
    result: "A booked job, not a lost caller",
  },
  inquiry: {
    trigger: "A new lead fills out a form or sends a message",
    draft: "A reply in your voice with two times to talk",
    result: "A first call on your calendar",
  },
  showup: {
    trigger: "Someone books an appointment",
    draft: "Reminders a day and an hour before",
    result: "Fewer no-shows",
  },
  catering: {
    trigger: "Someone asks about catering for an event",
    draft: "A reply with three packages to pick from",
    result: "A catering order on the books",
  },
  callfollow: {
    trigger: "A prospect says 'let me think about it'",
    draft: "Check-ins on day 1, 3 and 7",
    result: "A yes instead of silence",
  },
  closer: {
    trigger: "A customer goes quiet after a quote",
    draft: "Up to three follow-ups, then it stops",
    result: "A signed quote",
  },
  debrief: {
    trigger: "Your tech texts a voice note after a visit",
    draft: "A follow-up with the job, price and next step",
    result: "No estimate lost between the truck and the office",
  },
  reactivator: {
    trigger: "A past customer hasn't booked in over a year",
    draft: "One batch of come-back texts",
    result: "Repeat work in the slow season",
  },
  keeper: {
    trigger: "A maintenance plan is a month from renewal",
    draft: "A renewal text 30 days out",
    result: "A renewed plan",
  },
  referral: {
    trigger: "A client is two weeks from finishing",
    draft: "An ask for a testimonial and a referral",
    result: "A testimonial and a new lead",
  },
  reviewer: {
    trigger: "A job or visit is finished and paid",
    draft: "One request for a Google review",
    result: "A new Google review",
  },
  nudger: {
    trigger: "An invoice goes past due",
    draft: "A friendly payment reminder",
    result: "A paid invoice",
  },
  pricewatch: {
    trigger: "A supplier sends an invoice",
    draft: "Price rises flagged for your rep",
    result: "A price rise caught before it eats your margin",
  },
  posts: {
    trigger: "Your hours, menu or specials change",
    draft: "A post for you to publish",
    result: "Customers see the right hours and specials",
  },
  reviewdrafter: {
    trigger: "A customer leaves a review",
    draft: "A reply that mentions their visit",
    result: "An answered review",
  },
  brief: {
    trigger: "A new day starts",
    draft: "Your morning brief",
    result: "You know what needs you today",
  },
  triage: {
    trigger: "You forward an email to Anchored",
    draft: "A card for the right agent",
    result: "Nothing lost in your inbox",
  },
  license: {
    trigger: "A license or permit nears renewal",
    draft: "A heads-up 30 days before",
    result: "Renewed on time",
  },
  stockcheck: {
    trigger: "Your weekly SNAP stock count comes due",
    draft: "A list of gaps for your next wholesale run",
    result: "Shelves that meet the SNAP rule",
  },
};

/** Triggers said in one trade's own words; every other trade and skill uses `SKILL_STEPS`. */
export const TRADE_TRIGGERS: Readonly<Partial<Record<TradeKey, Partial<Record<SkillId, string>>>>> = {
  restaurant: { showup: "A guest books a table" },
  home: { showup: "A customer books a visit" },
  coach: { showup: "Someone books a discovery call" },
};

/** What a tool covering each workflow does, in the owner's words. */
export const TOOL_STEPS: Readonly<Record<WorkflowId, ToolSteps>> = {
  calls: {
    trigger: "A customer calls while you're busy",
    does: "Answers the phone for you",
    result: "A call answered, not sent to voicemail",
  },
  books: {
    trigger: "You finish a job or a sale",
    does: "Keeps your books and sends invoices",
    result: "An invoice sent and tracked",
  },
  leads: {
    trigger: "A new lead writes in",
    does: "Follows up with new leads",
    result: "A first call booked",
  },
  social: {
    trigger: "You have news, new hours or a special",
    does: "Runs your posts and marketing",
    result: "Customers see what's new",
  },
  quotes: {
    trigger: "You send a quote",
    does: "Tracks quotes and follows up",
    result: "A signed quote",
  },
  invoices: {
    trigger: "A supplier sends an invoice",
    does: "Scans supplier invoices and tracks prices",
    result: "A price rise caught early",
  },
  disputes: {
    trigger: "A delivery app refunds an order",
    does: "Disputes refunds you didn't owe",
    result: "Refund money back in your payout",
  },
  noshows: {
    trigger: "Someone books with you",
    does: "Sends booking reminders",
    result: "Fewer no-shows",
  },
  scheduling: {
    trigger: "Someone can't make their shift",
    does: "Builds the staff schedule and fills gaps",
    result: "A covered shift",
  },
  reviews: {
    trigger: "A customer leaves a review",
    does: "Lets you answer reviews where they're posted",
    result: "An answered review",
  },
  catering: {
    trigger: "Someone asks about catering for an event",
    does: "Takes catering and event orders",
    result: "A catering order on the books",
  },
  snap: {
    trigger: "Your weekly SNAP stock count comes due",
    does: "Tracks SNAP staples on your shelves",
    result: "Shelves that meet the SNAP rule",
  },
  licenses: {
    trigger: "A license or permit nears renewal",
    does: "Tracks license renewals",
    result: "Renewed on time",
  },
  memberships: {
    trigger: "A maintenance plan nears renewal",
    does: "Renews maintenance plans",
    result: "A renewed plan",
  },
  referrals: {
    trigger: "A client nears the end of their program",
    does: "Asks finishing clients for referrals",
    result: "A new referral",
  },
};
