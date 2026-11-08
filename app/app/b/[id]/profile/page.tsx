import { MessageSquare, Plus } from "lucide-react";
import type { Metadata } from "next";
import { ProfileCard } from "@/components/business/ProfileCard";
import { RecentChanges } from "@/components/business/RecentChanges";
import { NEW_BUSINESS_HREF, businessHref } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { rulesFor } from "@/lib/domain/agents";
import type { BusinessProfile } from "@/lib/domain/types";
import { listBusinessChat } from "@/lib/server/business-chat";
import { getBusinessOrNotFound } from "@/lib/server/data";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// The business profile, one job: what every agent knows. One card of facts,
// then, for the owner's own business, the recent changes the chat made. The
// header sends the owner to Chat to change a fact, or the example's visitor to
// start their own business.

export const metadata: Metadata = { title: "Profile" };

/** Say who wrote this profile and how far to trust it. */
function authorship(business: BusinessProfile): string {
  if (business.builtBy === "claude") return "Written by AI from your answers. Check each line before you rely on it.";
  if (business.kind === "custom") return "Mapped from your answers by Anchored's rules.";
  return "Written from our research. Numbers marked estimated are arithmetic on research ranges, not measurements.";
}

/** Render the profile and its recent changes for the business in the URL. */
export default async function ProfilePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const isSample = business.kind === "case";
  // The example's chat never changes anything, so it has no changes to list.
  const chat = isSample ? null : await listBusinessChat(await getSessionId(), business);

  return (
    <div className="prof-page">
      <PageHeader
        title="Profile"
        description="What every agent knows about this business."
        actions={
          isSample ? (
            <ButtonLink href={NEW_BUSINESS_HREF} variant="secondary">
              <Plus aria-hidden="true" size={16} />
              Set up your business
            </ButtonLink>
          ) : (
            <ButtonLink href={businessHref(business.id, "chat")} variant="secondary">
              <MessageSquare aria-hidden="true" size={16} />
              Tell Anchored what changed
            </ButtonLink>
          )
        }
      />
      <ProfileCard business={business} rules={rulesFor(business)} footnote={authorship(business)} />
      {chat !== null && (
        <section className="section" aria-labelledby="changes">
          <SectionHeader id="changes" title="Recent changes" />
          <RecentChanges messages={chat.messages} isSample={false} />
        </section>
      )}
    </div>
  );
}
