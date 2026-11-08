import "server-only";
import { readSheetValues, serviceAccountFrom, type ServiceAccount } from "@/lib/connectors/google-sheets";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import { dateIn, parseInvoiceRows, sheetEvents, type SheetSyncResult } from "@/lib/domain/invoice-sheet";
import type { BusinessProfile } from "@/lib/domain/types";
import { ingestEvent } from "@/lib/server/ingest";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Bookkeeping's Google Sheets link. `syncInvoiceSheet` reads the owner's
// invoice sheet as Anchored's service account and sends each overdue unpaid
// row and each paid row through `ingestEvent`, the same path as the webhooks
// and the chat, so the reminder cap, the payment cancel and the draft check all
// apply. Each row's card is keyed by its invoice, so checking the sheet again
// drafts nothing twice. `sheetsServiceAccount` names the robot an owner shares with.

/** Anchored's Google robot account, or `null` when this server has no Google key. */
export function sheetsServiceAccount(env: Readonly<Record<string, string | undefined>> = process.env): ServiceAccount | null {
  return serviceAccountFrom(env);
}

/** Read the sheet `sheetId` for `business` and turn its overdue and paid rows into reminders and stopped reminders. */
export async function syncInvoiceSheet(session: string, business: BusinessProfile, sheetId: string, account: ServiceAccount, now = new Date(), read = readSheetValues): Promise<SheetSyncResult> {
  const rows = await read(account, sheetId);
  const parsed = parseInvoiceRows(rows);
  const empty = { invoices: 0, drafted: 0, stopped: 0, alreadyDrafted: 0, notDue: 0 };
  if (parsed.missingColumns.length > 0) return { ...empty, problems: [], missingColumns: parsed.missingColumns };

  const events = sheetEvents(parsed.invoices, dateIn(OWNER_TIME_ZONE, now));
  const store = getStore();
  const cards = await store.listCards(session, business.id);
  const keys = new Set(cards.map((card) => card.key));
  const reminderFor = (invoice: string) => cards.filter((card) => card.skill === "nudger" && card.invoice?.key === invoice);
  const problems = [...parsed.problems, ...events.problems];
  let drafted = 0;
  let alreadyDrafted = 0;
  let stopped = 0;

  for (const event of events.late) {
    const key = `${business.id}:sheet:late:${event.key}`;
    // One reminder per overdue row from the sheet, including one the owner already drafted in chat. A second is the owner's call.
    if (keys.has(key) || reminderFor(event.key).some((card) => card.status === "pending" || card.status === "approved")) {
      alreadyDrafted += 1;
      continue;
    }
    const result = await ingestEvent(session, business, "invoice-late", event.payload, "live", { key });
    if (result.ok) drafted += 1;
    else problems.push(result.error);
  }

  for (const event of events.paid) {
    const key = `${business.id}:sheet:paid:${event.key}`;
    // A paid row matters only once, and only when a reminder was ever drafted for it.
    if (keys.has(key) || reminderFor(event.key).length === 0) continue;
    const result = await ingestEvent(session, business, "invoice-paid", event.payload, "live", { key });
    if (result.ok) stopped += (result.canceled?.cards ?? 0) + (result.canceled?.outbox ?? 0);
    else problems.push(result.error);
  }

  return { invoices: parsed.invoices.length, drafted, stopped, alreadyDrafted, notDue: events.notDue, problems, missingColumns: [] };
}
