"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { callApi, errorText } from "@/components/api";
import { buttonClass, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { AddJobRequest, AddJobResponse } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// The button that adds a job from the tools page's "jobs you could hand off"
// band. It posts the job and who handles it, toasts what changed with a link
// to the job on the Workflows page, and refreshes the server-rendered page so
// the job leaves the band and its tool shows as in the owner's stack.

/** Render a button that adds the job in `request` to `businessId`, then toasts `done` with a link to `workflowsHref`. */
export function AddJobButton({
  businessId,
  request,
  variant,
  label,
  done,
  workflowsHref,
  children,
}: {
  readonly businessId: string;
  readonly request: AddJobRequest;
  readonly variant: ButtonVariant;
  /** Names the job and who handles it for screen readers, such as "Add staff scheduling with Homebase". */
  readonly label: string;
  /** The toast after the job is added, in the owner's words. */
  readonly done: string;
  readonly workflowsHref: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // Stays pending until the refreshed page arrives, so the button can't add the job twice.
  const [refreshing, startRefresh] = useTransition();

  async function add() {
    setSaving(true);
    try {
      await callApi<AddJobResponse>(`/api/businesses/${encodeURIComponent(businessId)}/workflows`, "POST", request);
      toast(done, { label: "See it in Workflows", href: workflowsHref });
      startRefresh(() => router.refresh());
    } catch (error) {
      toast(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <button type="button" className={buttonClass(variant, "sm")} aria-label={label} onClick={add} disabled={saving || refreshing}>
      {children}
    </button>
  );
}
