import type { Metadata } from "next";
import { ProfileSummary } from "@/components/business/ProfileCard";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { chatStarters } from "@/components/chat/starters";
import { PageHeader } from "@/components/ui/PageHeader";
import { getBusinessOrNotFound } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The business chat, filling the window: the owner tells Anchored what changed
// and it updates the workflows, with the profile it reads in the right rail.
// A sample's chat is read-only; Anchored's first message says so, once.

export const metadata: Metadata = { title: "Chat" };

/** Render the chat for the business in the URL. */
export default async function ChatPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);

  return (
    <div className="fill-page">
      <PageHeader compact title="Chat" />
      <div className="chat-layout">
        <div className="chat-stage">
          <ChatWindow
            mode="business"
            businessId={business.id}
            readOnly={business.kind === "case"}
            starters={chatStarters(business)}
          />
        </div>
        <aside className="rail" aria-label="What Anchored knows about this business">
          <ProfileSummary business={business} />
        </aside>
      </div>
    </div>
  );
}
