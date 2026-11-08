"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { callApi, errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { InvoiceSheetCheckRequest, InvoiceSheetCheckResponse } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// "Check my invoice sheet now" on the payment reminders automation page. Asks
// the server to read the connected Google Sheet, toasts what it found, such as
// "I drafted 2 reminders", and refreshes the page so new drafts show.

/** Render the button that reads the business's invoice sheet now. */
export function CheckSheetButton({ businessId, approvalsHref }: { readonly businessId: string; readonly approvalsHref: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function check() {
    setBusy(true);
    try {
      const request: InvoiceSheetCheckRequest = {};
      const { reply } = await callApi<InvoiceSheetCheckResponse>(`/api/businesses/${encodeURIComponent(businessId)}/invoice-sheet`, "POST", request);
      toast(reply, { label: "See drafts", href: approvalsHref });
      startRefresh(() => router.refresh());
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={check} disabled={busy || refreshing}>
      <RefreshCw aria-hidden="true" size={16} />
      {busy || refreshing ? "Checking your sheet..." : "Check my invoice sheet now"}
    </Button>
  );
}
