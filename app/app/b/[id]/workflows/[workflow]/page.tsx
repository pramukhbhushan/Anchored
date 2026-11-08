import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { AgentWorkspace } from "@/components/business/agents/AgentWorkspace";
import { BriefRun } from "@/components/business/agents/BriefRun";
import { CustomerThreads } from "@/components/business/agents/CustomerThreads";
import { cardsForAgent, presentAgents } from "@/components/business/agents/view-model";
import { AcknowledgmentRuleControl } from "@/components/connections/AcknowledgmentRuleControl";
import { TelegramQr } from "@/components/connections/TelegramQr";
import { TelegramSetup } from "@/components/connections/TelegramSetup";
import { activeAgents } from "@/lib/domain/paths";
import { readBrief } from "@/lib/server/brief";
import { customerThreads } from "@/lib/server/customer-threads";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";
import { getSessionId } from "@/lib/server/session";
import { readStandingRules } from "@/lib/server/standing-rules";
import { telegramSetup } from "@/lib/server/telegram-setup";

// =============================================================================
// Module Overview
// =============================================================================
// Agent pages, one segment under Workflows. Every agent shows its drafts and
// recent work from the feed. Customer adds its Telegram conversations, the
// business's Telegram link and the acknowledgment rule; Internal
// Communications adds the daily brief and Run now. All reads are the owner's
// own, from the server; nothing here uses fixtures.

type Params = Promise<{ id: string; workflow: string }>;
type SearchParams = Promise<{ contact?: string | string[] }>;

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

/** Show an active agent with its drafts, plus Customer's conversations and Internal's brief. */
export default async function AgentPage({ params, searchParams }: { readonly params: Params; readonly searchParams: SearchParams }) {
  const { id, workflow: agentSegment } = await params;
  const { business, agent } = await findWorkspace(id, agentSegment);
  const [feed, session] = await Promise.all([getFeed(business), getSessionId()]);
  const contact = (await searchParams).contact;
  const selected = typeof contact === "string" && contact !== "" ? contact.slice(0, 64) : null;
  const [threads, telegram, rules, brief] = await Promise.all([
    agent.id === "customer" ? customerThreads(session, business, selected) : null,
    agent.id === "customer" ? telegramSetup(session, business) : null,
    agent.id === "customer" ? readStandingRules(session, business) : null,
    agent.id === "internal" ? readBrief(session, business) : null,
  ]);
  return (
    <AgentWorkspace businessId={business.id} agent={agent} cards={cardsForAgent(feed.cards, agent.id)} outbox={feed.outbox}>
      {threads !== null && <CustomerThreads businessId={business.id} data={threads} />}
      {telegram !== null && rules !== null && (
        <details>
          <summary>Telegram link and acknowledgment</summary>
          <div className="section">
            <TelegramSetup businessId={business.id} url={telegram.url} unavailableReason={telegram.unavailableReason ?? undefined} qrCode={telegram.url === null ? undefined : <TelegramQr url={telegram.url} />} />
          </div>
          <AcknowledgmentRuleControl businessId={business.id} businessName={business.name} state={rules.acknowledge} unavailableReason={rules.unavailableReason ?? undefined} />
        </details>
      )}
      {brief !== null && <BriefRun businessId={business.id} brief={brief} />}
    </AgentWorkspace>
  );
}
