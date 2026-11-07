"use client";

import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cardSource } from "@/components/agent-labels";
import { callApi, errorText } from "@/components/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import type { EventCardResponse, SimulateRequest } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// "Simulate a new event": asks the cards route to draft one more card from a
// chosen skill, the way a missed call or a new invoice would, then toasts who
// drafted it and refreshes the feed.

/** Render the simulate button; `agentNames` names agents in the toast, whose link goes to `seeHref`. */
export function SimulateButton({
  businessId,
  agentNames,
  seeHref,
}: {
  readonly businessId: string;
  readonly agentNames: Readonly<Record<string, string>>;
  /** Where the new card shows: `#waiting` on the approvals page, the approvals page from anywhere else. */
  readonly seeHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function simulate() {
    setBusy(true);
    try {
      // An empty request lets the route rotate through every chosen skill.
      const request: SimulateRequest = {};
      const { added } = await callApi<EventCardResponse>(
        `/api/businesses/${encodeURIComponent(businessId)}/cards`,
        "POST",
        request,
      );
      toast(
        added === null
          ? "New card added"
          : `New card from ${cardSource(added.agent === null ? null : (agentNames[added.agent] ?? null), added.skill)}`,
        { label: "See it", href: seeHref },
      );
      startRefresh(() => router.refresh());
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={simulate} disabled={busy || refreshing}>
      <Zap aria-hidden="true" size={16} />
      {busy || refreshing ? "Drafting..." : "Simulate a new event"}
    </Button>
  );
}
