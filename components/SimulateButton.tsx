"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cardSource } from "@/components/agent-labels";
import { callApi, errorText } from "@/components/api";
import { useToast } from "@/components/Toast";
import type { CardRecord, CardsResponse, SimulateRequest } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// "Simulate a new event": asks the cards route to draft one more card from a
// chosen skill, the way a missed call or a new invoice would, then toasts who
// drafted it and refreshes the feed.

/** Return the most recently created card, the one the simulation just added. */
function newest(cards: readonly CardRecord[]): CardRecord | undefined {
  // ISO 8601 timestamps sort as strings.
  return cards.reduce<CardRecord | undefined>((best, c) => (best === undefined || c.createdAt > best.createdAt ? c : best), undefined);
}

/** Render the simulate button; `agentNames` maps each active agent's ref to its name for the toast. */
export function SimulateButton({
  businessId,
  agentNames,
}: {
  readonly businessId: string;
  readonly agentNames: Readonly<Record<string, string>>;
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
      const { cards } = await callApi<CardsResponse>(
        `/api/businesses/${encodeURIComponent(businessId)}/cards`,
        "POST",
        request,
      );
      const card = newest(cards);
      toast(
        card === undefined
          ? "New card added"
          : `New card from ${cardSource(card.agent === null ? null : (agentNames[card.agent] ?? null), card.skill)}`,
      );
      startRefresh(() => router.refresh());
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn ghost" onClick={simulate} disabled={busy || refreshing}>
      Simulate a new event
    </button>
  );
}
