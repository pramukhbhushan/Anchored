import { z } from "zod";

// =============================================================================
// Module Overview
// =============================================================================
// License Clerk reads only the owner's recorded license names, dates and
// evidence. It compares civil dates in the business's time zone, so a clock
// change cannot move a reminder into another warning window. A notice is an
// owner-only task, never permission to contact anyone or renew a license.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The default business time zone until the owner records another one. */
const DEFAULT_RENEWAL_TIME_ZONE = "America/New_York";

/** A real Gregorian date, written without a time or an assumed time zone. */
const renewalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date such as 2027-03-15.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Add a real expiry date.");

/** The owner's license facts, including where the expiry date came from. */
export const licenseSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, "The license needs a stable id."),
  name: z.string().trim().min(1, "Add the license name.").max(120),
  expiresOn: renewalDateSchema,
  evidence: z.string().trim().min(1, "Say where this expiry date came from.").max(1000),
  completed: z.boolean().optional(),
}).strict();

/** The bounded license list cannot give two licenses the same identity. */
export const licensesSchema = z.array(licenseSchema).max(100).refine((licenses) => new Set(licenses.map((license) => license.id)).size === licenses.length, "Each license needs its own id.");

/** One evidenced license whose renewal the owner handles. */
export type License = z.infer<typeof licenseSchema>;

/** The current warning window, used as part of the persisted reminder key. */
export type RenewalWindow = "30-days" | "7-days" | "expiry-day" | "overdue";

/** A deterministic owner notice, before the server writes its flag card. */
export interface RenewalNotice {
  readonly key: string;
  readonly licenseId: string;
  readonly window: RenewalWindow;
  readonly daysUntilExpiry: number;
  readonly title: string;
  readonly body: string;
}

/** Return the license's current warning, or no warning for completed, distant or invalid facts. */
export function renewalNotice(license: License, now: Date, timeZone = DEFAULT_RENEWAL_TIME_ZONE): RenewalNotice | null {
  const parsed = licenseSchema.safeParse(license);
  if (!parsed.success || parsed.data.completed === true || !Number.isFinite(now.getTime())) return null;
  const today = civilDay(now, timeZone);
  if (today === null) return null;
  const expiry = Date.parse(`${parsed.data.expiresOn}T00:00:00.000Z`) / DAY_MS;
  const daysUntilExpiry = expiry - today;
  if (daysUntilExpiry > 30) return null;
  const window: RenewalWindow = daysUntilExpiry < 0 ? "overdue" : daysUntilExpiry === 0 ? "expiry-day" : daysUntilExpiry <= 7 ? "7-days" : "30-days";
  const when = daysUntilExpiry < 0 ? "has passed its recorded expiry date" : daysUntilExpiry === 0 ? "expires today" : `expires in ${daysUntilExpiry} ${daysUntilExpiry === 1 ? "day" : "days"}`;
  return {
    key: `renewal:${parsed.data.id}:${parsed.data.expiresOn}:${window}`,
    licenseId: parsed.data.id,
    window,
    daysUntilExpiry,
    title: `${parsed.data.name} ${when}`,
    body: `${parsed.data.name}'s recorded expiry date is ${parsed.data.expiresOn}. Date source: ${parsed.data.evidence}\nCheck the license and handle its renewal yourself. Anchored has not renewed or filed anything.`,
  };
}

/** Return the business's civil date as a day number, or null for an unknown time zone. */
function civilDay(at: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    const date = `${value("year")?.padStart(4, "0")}-${value("month")}-${value("day")}`;
    const result = renewalDateSchema.safeParse(date);
    return result.success ? Date.parse(`${result.data}T00:00:00.000Z`) / DAY_MS : null;
  } catch {
    return null;
  }
}
