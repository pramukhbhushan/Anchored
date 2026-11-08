// =============================================================================
// Module Overview
// =============================================================================
// The landing page's example day at Linden Street Kitchen, the app's sample
// restaurant: each message, when it arrives, and where it ends up. Every one
// lands in Waiting on you first. Approved ones move to Done, and one approved
// after 8 p.m. moves to Held till morning, as `checkSend` does in the app.
// `boardAt` says which cards sit in each column at a given minute, so the
// board can play the day through.

/** A column on the board. */
export type Column = "wait" | "done" | "held";

/** One message on the board. `moveAt` is when the owner approved it; cards without one stay waiting. */
export interface BoardCard {
  readonly id: string;
  readonly at: number;
  readonly moveAt?: number;
  readonly to: Column;
  readonly who: string;
  readonly about: string;
  readonly text: string;
  readonly stamp?: string;
  readonly actions: readonly string[];
}

/** The column titles, in board order. */
export const COLUMNS: readonly { readonly id: Column; readonly title: string }[] = [
  { id: "wait", title: "Waiting on you" },
  { id: "done", title: "Done" },
  { id: "held", title: "Held till morning" },
];

/** Example messages, from the Linden Street Kitchen sample in lib/domain/cases.ts. */
export const CARDS: readonly BoardCard[] = [
  { id: "dana", at: 600, moveAt: 652, to: "done", who: "Dana Price", about: "Office lunch Friday", text: "Hi Dana, following up on Friday's lunch for 25. Want me to hold the taco bar for you?", stamp: "Edited, sent 10:52 a.m.", actions: ["Send email", "Edit"] },
  { id: "post", at: 720, moveAt: 790, to: "done", who: "Instagram post", about: "For tonight", text: "Taco Tuesday: $3 tacos from 4 to 7 tonight. Walk-ins welcome.", stamp: "Copied, posted 1:10 p.m.", actions: ["Copy post", "Edit"] },
  { id: "marcus", at: 845, to: "wait", who: "Marcus Reed", about: "Party of 40", text: "Hi Marcus, thanks for thinking of Linden Street Kitchen! For 40 people we offer a taco bar, bowls with sides, or family-style platters. Which sounds closest?", actions: ["Send email", "Edit"] },
  { id: "avocado", at: 930, moveAt: 962, to: "done", who: "Avocados up $6 a case", about: "Produce invoice", text: "Your latest produce invoice charges $48 a case, up from $42 on the one before. Add it to your rep list?", stamp: "On your rep list, 4:02 p.m.", actions: ["Add to rep list", "Edit"] },
  { id: "listing", at: 990, to: "wait", who: "Your Google listing", about: "Old hours", text: "New hours start Monday: open 11 to 9, closed Tuesdays. Planning an event? Ask us about catering.", actions: ["Copy post", "Edit"] },
  { id: "allergy", at: 1110, to: "wait", who: "Allergy question", about: "From Ana", text: "Ana asked whether the mole has peanuts. Anchored doesn't answer allergy questions. Call her or reply yourself.", actions: ["I'll handle it"] },
  { id: "lee", at: 1215, moveAt: 1235, to: "held", who: "Lee Park", about: "Catering for 15", text: "Thanks for asking about Saturday. We can do a taco bar for 15. Want a quote?", stamp: "Goes out 8:00 a.m.", actions: ["Send text", "Edit"] },
];

export const DAY_START = 540;
export const DAY_END = 1260;

/** Return the column a card sits in at `minute`, or `null` before it arrives. */
export function columnAt(card: BoardCard, minute: number): Column | null {
  if (minute < card.at) return null;
  if (card.moveAt !== undefined && minute >= card.moveAt) return card.to;
  return "wait";
}

/** Return the cards in each column at `minute`, each column in the order its cards arrived there. */
export function boardAt(minute: number): Readonly<Record<Column, readonly BoardCard[]>> {
  const entered = (card: BoardCard, column: Column) => (column === "wait" ? card.at : (card.moveAt ?? card.at));
  const board: Record<Column, BoardCard[]> = { wait: [], done: [], held: [] };
  for (const card of CARDS) {
    const column = columnAt(card, minute);
    if (column !== null) board[column].push(card);
  }
  for (const column of Object.keys(board) as Column[]) board[column].sort((a, b) => entered(a, column) - entered(b, column));
  return board;
}

/** Format minutes after midnight as "HH:MM", stopping at the end of the day. */
export function clockLabel(minute: number): string {
  const m = Math.min(Math.max(minute, 0), DAY_END);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
}
