import type { PathKind, SignalId, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The workflow list, path names and onboarding options. `WORKFLOWS` holds the
// fifteen workflows in display order; the five in `BASE_WORKFLOWS` apply to
// every business, and onboarding facts (`SIGNALS`) add the rest.

/** One workflow: its id, display name, and whether every business gets it. */
export interface WorkflowDef {
  readonly id: WorkflowId;
  readonly name: string;
  readonly base: boolean;
}

/** One onboarding fact: the checkbox label and the short form shown on a profile. */
export interface SignalDef {
  readonly id: SignalId;
  readonly label: string;
  readonly short: string;
}

// =============================================================================
// Workflows
// =============================================================================

/** Every workflow, keyed by id, in display order. */
export const WORKFLOWS: Readonly<Record<WorkflowId, WorkflowDef>> = {
  calls: { id: "calls", name: "Answer and return calls", base: true },
  books: { id: "books", name: "Bookkeeping and invoicing", base: true },
  leads: { id: "leads", name: "Lead follow-up", base: true },
  social: { id: "social", name: "Social posts and marketing", base: true },
  quotes: { id: "quotes", name: "Quotes and estimates", base: true },
  invoices: { id: "invoices", name: "Supplier invoice and price check", base: false },
  disputes: { id: "disputes", name: "Delivery disputes", base: false },
  noshows: { id: "noshows", name: "No-shows and reminders", base: false },
  scheduling: { id: "scheduling", name: "Staff scheduling", base: false },
  reviews: { id: "reviews", name: "Reviews", base: false },
  catering: { id: "catering", name: "Catering and events", base: false },
  snap: { id: "snap", name: "SNAP stocking check", base: false },
  licenses: { id: "licenses", name: "License renewals", base: false },
  memberships: { id: "memberships", name: "Maintenance plan renewals", base: false },
  referrals: { id: "referrals", name: "Referrals and testimonials", base: false },
};

// `Object.keys` widens to `string[]`; the keys of an exhaustive `Record<WorkflowId, _>` literal are exactly `WorkflowId`.
/** Every workflow id in display order. */
export const WORKFLOW_IDS: readonly WorkflowId[] = Object.keys(WORKFLOWS) as WorkflowId[];

/** The five workflows every business gets. */
export const BASE_WORKFLOWS: readonly WorkflowId[] = WORKFLOW_IDS.filter((id) => WORKFLOWS[id].base);

// =============================================================================
// Paths
// =============================================================================

/** Short button label for each path. */
export const PATH_LABEL: Readonly<Record<PathKind, string>> = {
  turnon: "Turn on",
  buy: "Buy",
  build: "Build",
  skip: "Skip for now",
};

/** One-line explanation of each path. */
export const PATH_DESCRIPTION: Readonly<Record<PathKind, string>> = {
  turnon: "A tool you already pay for",
  buy: "A tool from the catalog",
  build: "An approve-first agent from Anchored",
  skip: "Small for your business today",
};

// =============================================================================
// Onboarding options
// =============================================================================

/** The placeholder the engine writes where onboarding gave no answer; views and the chat leave it out. */
export const NOT_GIVEN = "Not given";

/** Facts an owner can check during onboarding; each one can add workflows. */
export const SIGNALS: readonly SignalDef[] = [
  { id: "quotes", label: "I send quotes or estimates", short: "Sends quotes" },
  { id: "appointments", label: "Customers book appointments or tables", short: "Takes bookings" },
  { id: "suppliers", label: "I buy from suppliers or wholesalers", short: "Buys from suppliers" },
  { id: "shifts", label: "Staff work shifts", short: "Staff on shifts" },
  { id: "catering", label: "I take catering or event orders", short: "Takes catering" },
  { id: "snap", label: "I accept SNAP or EBT", short: "Accepts SNAP" },
  { id: "licenses", label: "I hold licenses or permits that renew", short: "Holds licenses" },
  { id: "memberships", label: "I sell plans or memberships", short: "Sells plans" },
  { id: "marketing", label: "I post or advertise regularly", short: "Markets already" },
];

/** Ways customers reach a business. */
export const REACH_OPTIONS: readonly string[] = ["Phone calls", "Walk-ins", "Website form", "Google", "Instagram or Facebook", "Referrals", "Delivery apps", "Email"];

/** Software and tools an owner can say they use today. */
export const TOOL_OPTIONS: readonly string[] = [
  "Paper and phone",
  "Cash register",
  "QuickBooks Online",
  "Square",
  "Clover",
  "Toast",
  "OpenTable",
  "DoorDash",
  "Jobber",
  "Housecall Pro",
  "Calendly",
  "Stripe",
  "Google Business Profile",
  "Google Sheets",
  "Gmail",
];

/** Languages an owner can say their customers speak. */
export const LANGUAGE_OPTIONS: readonly string[] = ["English", "Spanish", "Korean", "Chinese", "Arabic", "Hindi"];
