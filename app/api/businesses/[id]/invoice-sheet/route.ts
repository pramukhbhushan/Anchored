import type { InvoiceSheetCheckResponse } from "@/lib/api/contract";
import { invoiceSheetCheckSchema } from "@/lib/api/schemas";
import { sheetSyncReply } from "@/lib/domain/invoice-sheet";
import { ConnectorError } from "@/lib/connectors/errors";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { sheetsServiceAccount, syncInvoiceSheet } from "@/lib/server/invoice-sheet";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// "Check my invoice sheet now", from the payment reminders automation page.
// Reads the business's connected Google Sheet the same way the chat does, so
// overdue rows become reminders and paid rows stop them, and returns the
// sentence that says what it found. It never makes up an invoice: a business
// with no sheet connected is told how to connect one.

/** Read the business's invoice sheet now and say what the check did. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, invoiceSheetCheckSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const business = await findBusiness((await params).id);
    if (!business) return fail(404, "Business not found. It may have been deleted.");
    if (business.kind === "case") return fail(409, "The example business has no invoice sheet. Set up your own business to connect one.");
    if (!business.invoiceSheet) return fail(409, "No invoice sheet is connected yet. Paste your sheet's link in Chat to connect it.");
    const account = sheetsServiceAccount();
    if (account === null) return fail(409, "Google Sheets isn't set up on this server yet.");
    try {
      const result = await syncInvoiceSheet(await getSessionId(), business, business.invoiceSheet.id, account);
      return json<InvoiceSheetCheckResponse>({ reply: sheetSyncReply(result) });
    } catch (error) {
      if (error instanceof ConnectorError) return fail(error.retryable ? 503 : 409, error.message);
      throw error;
    }
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/invoice-sheet");
  }
}
