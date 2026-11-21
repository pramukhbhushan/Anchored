"use client";

import { useRouter } from "next/navigation";
import { callApi } from "@/components/api";
import type { BriefResponse } from "@/lib/api/contract";
import { BriefRunButton, type BriefRunResult } from "./BriefRunButton";

// =============================================================================
// Module Overview
// =============================================================================
// Connects Run now to `POST /api/businesses/[id]/brief`. The server counts
// every number; this only shows the lines it returns. A run that overlaps
// another returns the last finished brief, so the owner never sees a blank one.

/** Turn the server's brief into what the button shows, or `null` before the first one. */
function briefResult(brief: BriefResponse): BriefRunResult | null {
  return brief.lastRunAt === null ? null : { text: brief.lines.join("\n"), generatedAt: brief.lastRunAt };
}

/** Render the brief with a Run now button that asks the brief route for a new one. */
export function BriefRun({ businessId, brief }: { readonly businessId: string; readonly brief: BriefResponse }) {
  const router = useRouter();
  async function run(): Promise<BriefRunResult> {
    const fresh = await callApi<BriefResponse>(`/api/businesses/${encodeURIComponent(businessId)}/brief`, "POST");
    const result = briefResult(fresh);
    if (result === null) throw new Error("Another brief is being written right now. Try again in a moment.");
    // The brief's card joins Approvals, so the counts around the page refresh too.
    router.refresh();
    return result;
  }
  return <BriefRunButton businessId={businessId} brief={briefResult(brief)} run={brief.unavailableReason === null ? run : undefined} unavailableReason={brief.unavailableReason ?? undefined} />;
}
