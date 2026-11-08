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
// The example's chat is read-only; Anchored's first message says so, once.

export const metadata: Metadata = { title: "Chat" };

/** Render the chat for the business in the URL. */
export default async function ChatPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
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
            readOnly={business.kind === "case"}
            starters={chatStarters(business, chosen)}
          />
        </div>
        <aside className="rail" aria-label="What Anchored knows about this business">
          <ProfileSummary business={business} />
        </aside>
      </div>
    </div>
  );
}
