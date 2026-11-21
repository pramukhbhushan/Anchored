import { OWNER_TIME_ZONE } from "@/lib/domain/executor";

// =============================================================================
// Module Overview
// =============================================================================
// The one date and time format the business pages print, such as "Nov 7,
// 3:12 PM", always in the owner's time zone. The server and the browser format
// the same instant the same way, so a server-rendered time never shifts when
// the page hydrates.

const OWNER_TIME = new Intl.DateTimeFormat("en-US", { timeZone: OWNER_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Return `date` as the owner reads it, such as "Nov 7, 3:12 PM". */
export function ownerTime(date: Date): string {
  return OWNER_TIME.format(date);
}
