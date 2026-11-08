"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { callApi, errorText } from "@/components/api";
import { useToast } from "@/components/ui/Toast";
import type { SetChoiceRequest, SetChoiceResponse } from "@/lib/api/contract";
import { WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The button behind every change of who handles a workflow: the options under
// "Change who handles this" on the Workflows graph and the tools page's
// "Choose" and "Use". It saves the choice through the choices route, toasts
// what changed in the owner's words, and refreshes the server-rendered page.

/** Return the toast shown after a choice; `runner` names the tool the workflow now runs on, when known. */
function chosenMessage(request: SetChoiceRequest, runner: string | undefined): string {
  const name = WORKFLOWS[request.workflow].name;
  if (request.path === "skip") return `${name}: you handle it yourself for now`;
  if (request.path === "build") return `${name}: Anchored drafts it, you approve it`;
  if (runner !== undefined) return `${name} now runs on ${runner}`;
  return request.path === "turnon" ? `${name} now runs on a tool you have` : `${name} now runs on a new tool`;
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
  readonly className: string | undefined;
  readonly pressed?: boolean;
  /** Names the path and workflow for screen readers when the visible text is just "Choose". */
  readonly label?: string;
  /** The tool or agent this choice hands the workflow to, such as "Certus" or "Front Desk agent", for the toast. */
  readonly runner?: string | undefined;
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
