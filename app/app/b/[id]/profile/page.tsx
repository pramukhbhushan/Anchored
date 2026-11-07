import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ProfileCard } from "@/components/business/ProfileCard";
import { RecentChanges } from "@/components/business/RecentChanges";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { SampleBadge } from "@/components/business/SampleBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { rulesFor } from "@/lib/domain/agents";
import type { BusinessProfile } from "@/lib/domain/types";
import { listBusinessChat } from "@/lib/server/business-chat";
import { getBusinessOrNotFound } from "@/lib/server/data";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// The business profile. On the left, one card of facts: who the business is,
// how customers reach it, what it runs on, how it sounds, agent rules and
// niche agents. On the right, the business chat that changes them and the
// recent changes it made. Sample businesses show the chat read-only.

export const metadata: Metadata = { title: "Profile" };

/** Say who wrote this profile and how far to trust it. */
function authorship(business: BusinessProfile): string {
  if (business.builtBy === "claude") return "Written by AI from your answers. Check each line before you rely on it.";
  if (business.kind === "custom") return "Mapped from your answers by Anchored's rules.";
  return "Written from our research. Numbers marked modeled are arithmetic on research ranges, not measurements.";
}

/** Render the profile, the chat beside it and its recent changes for the business in the URL. */
export default async function ProfilePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const isSample = business.kind === "case";
  const chat = await listBusinessChat(await getSessionId(), business);

  return (
    <>
      <PageHeader
        title="Profile"
        badge={<SampleBadge business={business} />}
        description={
          isSample
            ? "What every agent knows about this sample business. Start your own to get a profile you can change."
            : "What every agent knows about your business. If something's wrong or new, tell Anchored and it updates your plan."
        }
        actions={
          isSample ? (
            <ButtonLink href={NEW_BUSINESS_HREF} variant="secondary">
              <Plus aria-hidden="true" size={16} />
              Start your own business
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="prof-page">
        <ProfileCard business={business} rules={rulesFor(business)} footnote={authorship(business)} />
        <div className="prof-side">
          <Card
            title="Tell Anchored something new"
            // The read-only chat already says how to start your own, so a sample needs no second line here.
            description={
              isSample
                ? undefined
                : "A new service, a tool you started using, or a new way customers reach you. Anchored updates the profile and your workflows."
            }
          >
            <div className="prof-chat">
              <ChatWindow mode="business" businessId={business.id} readOnly={isSample} />
            </div>
          </Card>
          <Card title="Recent changes">
            <RecentChanges messages={chat.messages} isSample={isSample} />
          </Card>
        </div>
      </div>
    </>
  );
}
