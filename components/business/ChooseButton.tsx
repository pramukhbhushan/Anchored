"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { callApi, errorText } from "@/components/api";
import { useToast } from "@/components/ui/Toast";
import type { SetChoiceRequest, SetChoiceResponse } from "@/lib/api/contract";
import { PATH_LABEL, WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The button behind every path choice: Choose, Skip for now, and the tools
// page's "Choose for" and "Turn on for". It saves the choice through the
// choices route, toasts what changed, and refreshes the server-rendered page.

/** Return the toast shown after a choice. */
function chosenMessage(request: SetChoiceRequest): string {
  const name = WORKFLOWS[request.workflow].name;
  return request.path === "skip" ? `${name}: skipped for now` : `${name}: ${PATH_LABEL[request.path].toLowerCase()} chosen`;
}

/** Render a button that saves `request` for `businessId`; `pressed` makes it a toggle, `label` its accessible name. */
export function ChooseButton({
  businessId,
  request,
  className,
  pressed,
  label,
  children,
}: {
  readonly businessId: string;
  readonly request: SetChoiceRequest;
  readonly className: string;
  readonly pressed?: boolean;
  /** Names the path and workflow for screen readers when the visible text is just "Choose". */
  readonly label?: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // Stays pending until the refreshed page arrives, so the button can't be pressed twice.
  const [refreshing, startRefresh] = useTransition();

  async function choose() {
    setSaving(true);
    try {
      await callApi<SetChoiceResponse>(`/api/businesses/${encodeURIComponent(businessId)}/choices`, "PUT", request);
      toast(chosenMessage(request));
      startRefresh(() => router.refresh());
    } catch (error) {
      toast(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-pressed={pressed}
      aria-label={label}
      onClick={choose}
      disabled={saving || refreshing}
    >
      {children}
    </button>
  );
}
