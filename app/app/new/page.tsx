import type { Metadata } from "next";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { OnboardForm } from "@/components/onboarding/OnboardForm";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { isAuthEnabled } from "@/lib/auth/config";
import { aiLabel } from "@/lib/server/ai";

// =============================================================================
// Module Overview
// =============================================================================
// `/app/new`, onboarding. Chat is the main way in and fills the window under a
// one-row header; `?form=1` swaps it for the one-page form, with "What happens
// next" beside it. Both create the business the same way and open its plan.

export const metadata: Metadata = { title: "Start a new business" };

// Provider keys can be set after a build, so check them per request rather than once at build time.
export const dynamic = "force-dynamic";

const NEXT_STEPS: readonly string[] = [
  "Anchored writes a one-page profile you can check.",
  "You get the five shared workflows, plus the ones your answers add.",
  "Each workflow gets three paths and our pick.",
  "Work only some businesses have, such as a SNAP stocking check, can get its own niche agent.",
  "Agents you choose start drafting cards for you to approve.",
];

/** Return the line that says who reads the owner's answers and where they are kept. */
function privacyLine(aiName: string | null, accountsOn: boolean): string {
  // With accounts off there is no account; the answers belong to this browser's session.
  const kept = accountsOn ? "stay in your account" : "stay with this browser";
  return aiName
    ? `Your answers go only to ${aiName} and ${kept}. Nothing is sent to your customers.`
    : `Anchored's own rules read your answers, which ${kept}. Nothing is sent to your customers.`;
}

/** Render chat onboarding, or the form when `?form=1`. */
export default async function NewBusinessPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { form } = await searchParams;
  const aiName = aiLabel();
  const privacy = privacyLine(aiName, isAuthEnabled());

  if (form === "1") {
    return (
      <>
        <PageHeader
          title="Start a new business"
          description="Answer what you can. Skip what you don't know."
          actions={
            <ButtonLink variant="secondary" href={NEW_BUSINESS_HREF}>
              Use chat instead
            </ButtonLink>
          }
        />
        <div className="form-layout">
          <OnboardForm aiName={aiName} />
          <aside className="rail">
            <Card title="What happens next" level={2}>
              <ol className="steps-list">
                {NEXT_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </Card>
            <p className="fine">{privacy}</p>
          </aside>
        </div>
      </>
    );
  }

  return (
    <div className="fill-page">
      <PageHeader
        compact
        title="Start a new business"
        actions={
          <ButtonLink variant="quiet" href={`${NEW_BUSINESS_HREF}?form=1`}>
            Prefer a form?
          </ButtonLink>
        }
      />
      <div className="chat-stage">
        <ChatWindow mode="intake" />
      </div>
      <p className="fine page-foot">{privacy}</p>
    </div>
  );
}
