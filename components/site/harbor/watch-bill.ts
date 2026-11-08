import type { CoreAgentId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's example day at an HVAC shop: what each agent does and
// when, and `dayAt`, which says what every row shows at a given minute so the
// watch bill can play the day through. Every draft waits for the owner; one
// approved after 8 p.m. holds until morning, as `checkSend` does in the app.

/** How a row's status reads: plain info, a draft, waiting on the owner, sent, held, or not yet. */
export type ChipKind = "info" | "draft" | "wait" | "sent" | "held" | "sched";

/** One step of a row's status. */
export interface Chip {
  readonly kind: ChipKind;
  readonly label: string;
}

/** One row of the day. `task` names the job in the owner's words; `steps` is one chip for info rows, or draft, wait and outcome for drafts. */
export interface WatchRow {
  readonly minute: number;
  readonly agent: CoreAgentId;
  readonly task: string;
  readonly what: string;
  readonly steps: readonly Chip[];
}

const draftFlow = (outcome: Chip): readonly Chip[] => [
  { kind: "draft", label: "Drafting" },
  { kind: "wait", label: "Waiting for you" },
  outcome,
];

/** Example data based on the College Park Heating & Air case study. */
export const DAY: readonly WatchRow[] = [
  { minute: 420, agent: "internal", task: "Morning summary", what: "Four replies are waiting on you, worth $2,140.", steps: [{ kind: "info", label: "In your summary" }] },
  { minute: 552, agent: "frontdesk", task: "Missed call", what: "A new number called and hung up. A text with two open times is drafted.", steps: draftFlow({ kind: "sent", label: "Approved · sent 9:14" }) },
  { minute: 640, agent: "internal", task: "Forwarded email", what: "A supplier email you forwarded goes to Bookkeeping.", steps: [{ kind: "info", label: "Handed off" }] },
  { minute: 665, agent: "books", task: "Supplier prices", what: "Filter price is up 18% from the last order.", steps: [{ kind: "info", label: "Flagged for you" }] },
  { minute: 870, agent: "followup", task: "Quote check-in", what: "A $1,200 quote from last week went quiet. A check-in is drafted.", steps: draftFlow({ kind: "sent", label: "Edited · sent 2:41" }) },
  { minute: 975, agent: "followup", task: "Review request", what: "Job closed. A Google review request is drafted.", steps: draftFlow({ kind: "sent", label: "Approved · sent 4:20" }) },
  { minute: 1020, agent: "content", task: "Review reply", what: "A reply to yesterday's four-star review is drafted.", steps: draftFlow({ kind: "sent", label: "Approved · posted" }) },
  { minute: 1205, agent: "frontdesk", task: "Missed call", what: "Approved at 8:05 p.m. Quiet hours start at 8.", steps: draftFlow({ kind: "held", label: "Held until 8:00 a.m." }) },
];

export const DAY_START = 420;
export const DAY_END = 1230;
/** How long after its time a draft row waits for the owner before its outcome shows. */
const DECIDE_AFTER = 90;
const WAIT_AFTER = 30;

/** What one row shows at a moment. */
export interface RowState {
  readonly chip: Chip;
  readonly future: boolean;
  readonly live: boolean;
}

/** What the whole bill shows at `minute`; `final` shows the finished day. */
export interface DayState {
  readonly rows: readonly RowState[];
  readonly drafts: number;
  readonly sent: number;
  readonly held: number;
}

/** Format minutes after midnight as "HH:MM". */
export function clockLabel(minute: number): string {
  const m = Math.min(Math.max(minute, 0), DAY_END);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
}

/** Return what every row and the tally show at `minute`, or the finished day when `final`. */
export function dayAt(minute: number, final = false): DayState {
  let drafts = 0, sent = 0, held = 0;
  const rows = DAY.map((row): RowState => {
    const dt = minute - row.minute;
    const last = row.steps[row.steps.length - 1]!;
    const isDraft = row.steps.length > 1;
    const done = final || dt >= DECIDE_AFTER || (!isDraft && dt >= 0);
    let chip: Chip;
    if (done) chip = last;
    else if (dt < 0) chip = { kind: "sched", label: "Scheduled" };
    else chip = row.steps[dt < WAIT_AFTER ? 0 : 1]!;
    if (isDraft && (final || dt >= 0)) drafts++;
    if (isDraft && done && last.kind === "sent") sent++;
    if (isDraft && done && last.kind === "held") held++;
    return { chip, future: !final && dt < 0, live: !final && dt >= 0 && dt < DECIDE_AFTER };
  });
  return { rows, drafts, sent, held };
}
