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

/** Return the toast shown after a choice; `runner` names the tool or agent the workflow now runs on, when known. */
function chosenMessage(request: SetChoiceRequest, runner: string | undefined): string {
  const name = WORKFLOWS[request.workflow].name;
  if (request.path === "skip") return `${name} is skipped for now`;
  if (runner === undefined) return `${name}: ${PATH_LABEL[request.path]} is your path now`;
  return request.path === "build" ? `${name} now goes to the ${runner}` : `${name} now runs on ${runner}`;
}

/** Render a button that saves `request` for `businessId`; `pressed` makes it a toggle, `label` its accessible name. */
export function ChooseButton({
  businessId,
  request,
  className,
  pressed,
  label,
  runner,
  children,
}: {
  readonly businessId: string;
  readonly request: SetChoiceRequest;
  readonly className: string;
  readonly pressed?: boolean;
  /** Names the path and workflow for screen readers when the visible text is just "Choose". */
  readonly label?: string;
  /** The tool or agent this choice hands the workflow to, such as "Certus" or "Front Desk agent", for the toast. */
  readonly runner?: string;
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
      toast(chosenMessage(request, runner));
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
