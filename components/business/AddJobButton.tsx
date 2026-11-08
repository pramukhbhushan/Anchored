"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { callApi, errorText } from "@/components/api";
import { buttonClass, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { AddJobRequest, AddJobResponse } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// The buttons that add a job from the tools page's "jobs you could hand off"
// band. `AddJobsGroup` posts one job at a time for the whole band: each add
// rewrites the owner's profile, so two at once would lose one. It toasts what
// changed with a link to the job on the Workflows page and refreshes the
// server-rendered page, so the job leaves the band and its tool shows as in
// the owner's stack. `AddJobButton` is one way in to one job.

interface AddJobs {
  /** True while an add saves or the page refreshes after it; every button in the band waits. */
  readonly pending: boolean;
  readonly add: (request: AddJobRequest, done: string, workflowsHref: string) => void;
}

const AddJobsContext = createContext<AddJobs | null>(null);

/** Hold the one add in flight for `businessId`'s band, so a second tap anywhere waits for the first to finish. */
export function AddJobsGroup({ businessId, children }: { readonly businessId: string; readonly children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // Stays pending until the refreshed page arrives, so a job can't be added twice.
  const [refreshing, startRefresh] = useTransition();
  // State updates land on the next render; the ref stops a second tap that arrives before it.
  const inFlight = useRef(false);

  async function add(request: AddJobRequest, done: string, workflowsHref: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await callApi<AddJobResponse>(`/api/businesses/${encodeURIComponent(businessId)}/workflows`, "POST", request);
      toast(done, { label: "See it in Workflows", href: workflowsHref });
      startRefresh(() => router.refresh());
    } catch (error) {
      toast(errorText(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <AddJobsContext.Provider value={{ pending: saving || refreshing, add: (...args) => void add(...args) }}>{children}</AddJobsContext.Provider>
  );
}

/** Render a button that adds the job in `request`, then toasts `done` with a link to `workflowsHref`. */
export function AddJobButton({
  request,
  variant,
  label,
  done,
  workflowsHref,
  children,
}: {
  readonly request: AddJobRequest;
  readonly variant: ButtonVariant;
  /** Names the job and who handles it for screen readers, such as "Add with Homebase for staff scheduling". */
  readonly label: string;
  /** The toast after the job is added, in the owner's words. */
  readonly done: string;
  readonly workflowsHref: string;
  readonly children: ReactNode;
}) {
  const group = useContext(AddJobsContext);
  if (group === null) throw new Error("AddJobButton must sit inside an AddJobsGroup.");
  return (
    <button
      type="button"
      className={buttonClass(variant, "sm")}
      aria-label={label}
      onClick={() => group.add(request, done, workflowsHref)}
      disabled={group.pending}
    >
      {children}
    </button>
  );
}
