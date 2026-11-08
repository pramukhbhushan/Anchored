import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CustomerThreads } from "@/components/business/agents/CustomerThreads";
import { TelegramSetup } from "@/components/connections/TelegramSetup";
import { AcknowledgmentRule } from "@/components/connections/AcknowledgmentRule";
import { AgentWorkspace } from "@/components/business/agents/AgentWorkspace";
import { cardsForAgent, presentAgents } from "@/components/business/agents/view-model";
import { activeAgents } from "@/lib/domain/paths";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Agent landing pages at the existing one-segment Workflows depth. The nested
// two-segment automation pages retain their current URLs and workflow meaning.
// Reads use the current domain and feed, never fixture or guessed API data.

type Params = Promise<{ id: string; workflow: string }>;

const findWorkspace = cache(async (id: string, agentSegment: string) => {
  const business = await getBusinessOrNotFound(id);
  const choices = await getChoices(business);
  const agent = presentAgents(activeAgents(business, choices)).find((item) => item.id === agentSegment);
  if (!agent) notFound();
  return { business, agent };
});

/** Name the tab after the active agent. */
export async function generateMetadata({ params }: { readonly params: Params }): Promise<Metadata> {
  const { id, workflow: agentSegment } = await params;
  const { agent } = await findWorkspace(id, agentSegment);
  return { title: agent.name };
}

/** Show an active agent using the existing business and approval feed. */
export default async function AgentPage({ params }: { readonly params: Params }) {
  const { id, workflow: agentSegment } = await params;
  const { business, agent } = await findWorkspace(id, agentSegment);
  const feed = await getFeed(business);
  return (
    <AgentWorkspace businessId={business.id} agent={agent} cards={cardsForAgent(feed.cards, agent.id)} outbox={feed.outbox}>
      {agent.id === "customer" && <>
        <CustomerThreads businessId={business.id} data={{ contacts: [], selectedContactId: null, messages: [], unavailableReason: "Customer conversations aren't available here yet. You can review existing drafts in Approvals." }} />
        <details><summary>Telegram setup and acknowledgment</summary>
          <div className="section"><TelegramSetup businessId={business.id} url={null} unavailableReason={business.kind === "case" ? "Set up your own business to try Telegram when it is available." : "Telegram isn't available for this business yet."} /></div>
          <AcknowledgmentRule businessId={business.id} businessName={business.name} state={null} unavailableReason="This rule isn't available yet. Your drafts still wait for approval." />
        </details>
      </>}
    </AgentWorkspace>
  );
}
