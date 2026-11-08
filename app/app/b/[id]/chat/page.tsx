import type { Metadata } from "next";
import { ProfileSummary } from "@/components/business/ProfileCard";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { SetupChat } from "@/components/chat/SetupChat";
import { chatStarters } from "@/components/chat/starters";
import { PageHeader } from "@/components/ui/PageHeader";
import { chosenSkills } from "@/lib/domain/paths";
import { getBusinessOrNotFound, getChoices, getSetupChat } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The business chat, filling the window: the owner tells Anchored what changed
// and it updates the workflows, or asks an agent for a draft that lands in
// Approvals, with the profile it reads in the right rail. The onboarding chat
// that set the business up stays above it, closed, to read again.
// Example visitors can chat in their own session without changing the shared business.
// `?ask=` carries words from an automation page's chat box into the text box.

export const metadata: Metadata = { title: "Chat" };

/** Render the chat for the business in the URL. */
export default async function ChatPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<{ ask?: string | string[] }> }) {
  const [{ id }, { ask }] = await Promise.all([params, searchParams]);
  const business = await getBusinessOrNotFound(id);
  const [choices, setup] = await Promise.all([getChoices(business), getSetupChat(business)]);
  const chosen = chosenSkills(business, choices);

  return (
    <div className="fill-page">
      <PageHeader compact title="Chat" />
      <div className="chat-layout">
        <div className="chat-stage">
          <SetupChat messages={setup} />
          <ChatWindow
            mode="business"
            businessId={business.id}
            starters={chatStarters(business, chosen)}
            ask={typeof ask === "string" ? ask.slice(0, 2000) : undefined}
          />
        </div>
        <aside className="rail" aria-label="What Anchored knows about this business">
          <ProfileSummary business={business} />
        </aside>
      </div>
    </div>
  );
}
