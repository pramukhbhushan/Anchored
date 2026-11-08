"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { callApi, errorText } from "@/components/api";
import { buttonClass } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ApprovePlanRequest, ApprovePlanResponse } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// The one filled button on the Workflows page: the owner's yes to the plan as
// a whole, or to the steps they changed since. It saves through the plan
// route, says the plan is live, and refreshes the server-rendered page.

const APPROVE: ApprovePlanRequest = { approved: true };

/** Render the button that approves the plan for `businessId`; `label` says whether it is the plan or the changes. */
export function ApprovePlanButton({ businessId, label }: { readonly businessId: string; readonly label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // Stays pending until the refreshed page arrives, so the button can't be pressed twice.
  const [refreshing, startRefresh] = useTransition();

  async function approve() {
    setSaving(true);
    try {
      await callApi<ApprovePlanResponse>(`/api/businesses/${encodeURIComponent(businessId)}/plan`, "PUT", APPROVE);
      toast("Approved. Your plan is live.");
      startRefresh(() => router.refresh());
    } catch (error) {
      toast(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <button type="button" className={buttonClass("primary", "md")} onClick={approve} disabled={saving || refreshing}>
      <Check aria-hidden="true" size={18} />
      {label}
    </button>
  );
}
