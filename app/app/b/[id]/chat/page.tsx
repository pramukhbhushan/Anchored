import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ProfileSummary } from "@/components/business/ProfileCard";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { SampleBadge } from "@/components/business/SampleBadge";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getBusinessOrNotFound } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The business chat, filling the window: the owner tells Anchored what changed
// and it updates the workflows, with the profile it reads in the right rail.
// Sample businesses mount the chat read-only and point to starting your own.

export const metadata: Metadata = { title: "Chat" };

/** Render the chat for the business in the URL. */
export default async function ChatPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const isSample = business.kind === "case";

  return (
    <div className="fill-page">
      <PageHeader
        compact
        title="Chat"
        badge={<SampleBadge business={business} />}
        description={
          isSample
            ? "Sample businesses are read-only, so this chat can't change the plan."
            : "Tell Anchored what changed, and it updates your workflows."
        }
        actions={
          isSample ? (
            <ButtonLink href={NEW_BUSINESS_HREF} variant="secondary" size="sm">
              <Plus aria-hidden="true" size={16} />
              Start your own business
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="chat-layout">
        <div className="chat-stage">
          <ChatWindow mode="business" businessId={business.id} readOnly={isSample} />
        </div>
        <aside className="rail" aria-label="What Anchored knows about this business">
          <ProfileSummary business={business} />
        </aside>
      </div>
    </div>
  );
}
