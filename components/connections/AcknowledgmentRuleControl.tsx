"use client";

import { useRouter } from "next/navigation";
import { callApi } from "@/components/api";
import type { AcknowledgmentState, StandingRulesResponse } from "@/lib/api/contract";
import { AcknowledgmentRule } from "./AcknowledgmentRule";

// =============================================================================
// Module Overview
// =============================================================================
// Connects the acknowledgment control to `PUT /api/businesses/[id]/standing-rules`.
// The control shows only the state the server saved; after a save the page
// refreshes so every other view of the rule agrees.

/** The acknowledgment control with its save wired to the server. */
export function AcknowledgmentRuleControl({ businessId, businessName, state, unavailableReason }: {
  readonly businessId: string;
  readonly businessName: string;
  readonly state: AcknowledgmentState | null;
  readonly unavailableReason?: string;
}) {
  const router = useRouter();
  async function save(enabled: boolean): Promise<AcknowledgmentState> {
    const saved = await callApi<StandingRulesResponse>(`/api/businesses/${encodeURIComponent(businessId)}/standing-rules`, "PUT", { enabled });
    router.refresh();
    return saved.acknowledge;
  }
  return <AcknowledgmentRule businessId={businessId} businessName={businessName} state={state} save={unavailableReason === undefined ? save : undefined} unavailableReason={unavailableReason} />;
}
