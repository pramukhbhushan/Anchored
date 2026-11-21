import { ChatWindow } from "@/components/chat/ChatWindow";
import { isAiConfigured } from "@/lib/server/ai";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { AgentWorkspace } from "@/components/business/agents/AgentWorkspace";
import { BriefRun } from "@/components/business/agents/BriefRun";
import { FollowupSchedule } from "@/components/business/agents/FollowupSchedule";
import { LicenseDates } from "@/components/business/agents/LicenseDates";
import { CustomerThreads } from "@/components/business/agents/CustomerThreads";
import { cardsForAgent, presentAgents } from "@/components/business/agents/view-model";
import { AcknowledgmentRuleControl } from "@/components/connections/AcknowledgmentRuleControl";
import { TelegramQr } from "@/components/connections/TelegramQr";
import { TelegramSetup } from "@/components/connections/TelegramSetup";
import { activeAgents, chosenSkills } from "@/lib/domain/paths";
import { readBrief } from "@/lib/server/brief";
import { customerThreads } from "@/lib/server/customer-threads";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";
import { followupSchedule } from "@/lib/server/followups";
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

/** The line above the agent's chat that says whether AI writes its replies, and how to turn it on. */
function aiReplyNote(aiOn: boolean, isExample: boolean): string {
  if (aiOn) return "AI replies are on. Drafts still wait for your OK.";
  if (isExample) return "AI replies are off for the example business. Supported draft requests still work.";
  return "AI replies are off. Add your AI key on Connections to turn them on. Supported draft requests still work.";
}
type SearchParams = Promise<{ contact?: string | string[] }>;

const findWorkspace = cache(async (id: string, agentSegment: string) => {
  const business = await getBusinessOrNotFound(id);
  const choices = await getChoices(business);
  const agent = presentAgents(activeAgents(business, choices)).find((item) => item.id === agentSegment);
  if (!agent) notFound();
  return { business, agent, choices };
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
  const { business, agent, choices } = await findWorkspace(id, agentSegment);
  const [feed, session] = await Promise.all([getFeed(business), getSessionId()]);
  const aiOn = await isAiConfigured({ session, businessId: business.id });
  const contact = (await searchParams).contact;
  const selected = typeof contact === "string" && contact !== "" ? contact.slice(0, 64) : null;
  const [threads, telegram, rules, brief, schedule] = await Promise.all([
    agent.id === "customer" ? customerThreads(session, business, selected) : null,
    agent.id === "customer" ? telegramSetup(session, business) : null,
    agent.id === "customer" ? readStandingRules(session, business) : null,
    agent.id === "internal" ? readBrief(session, business) : null,
    agent.id === "customer" && business.kind === "custom" ? followupSchedule(session, business) : null,
  ]);
  return (
    <AgentWorkspace businessId={business.id} agent={agent} cards={cardsForAgent(feed.cards, agent.id)} outbox={feed.outbox} ask={<><p className="fine">{aiReplyNote(aiOn, business.kind === "case")}</p><ChatWindow mode="business" businessId={business.id} agent={agent.id} agentName={agent.name} starters={["What can you help me with?", "What should I focus on next?"]} /></>}>
      {threads !== null && <CustomerThreads businessId={business.id} data={threads} />}
      {telegram !== null && rules !== null && (
        <details className="agent-details">
          <summary>Telegram link and acknowledgment</summary>
          <div className="agent-details-body">
            <TelegramSetup businessId={business.id} url={telegram.url} unavailableReason={telegram.unavailableReason ?? undefined} qrCode={telegram.url === null ? undefined : <TelegramQr url={telegram.url} />} />
            <AcknowledgmentRuleControl businessId={business.id} businessName={business.name} state={rules.acknowledge} unavailableReason={rules.unavailableReason ?? undefined} />
          </div>
        </details>
      )}
      {schedule !== null && <FollowupSchedule businessId={business.id} records={schedule.records} contacts={schedule.contacts} skills={chosenSkills(business, choices)} />}
      {brief !== null && <BriefRun businessId={business.id} brief={brief} />}
      {agent.id === "internal" && business.kind === "custom" && <LicenseDates businessId={business.id} licenses={business.details?.licenses ?? []} enabled={chosenSkills(business, choices).includes("license")} />}
    </AgentWorkspace>
  );
}
