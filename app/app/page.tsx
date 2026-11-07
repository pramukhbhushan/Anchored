import { ArrowRight, Plus, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NEW_BUSINESS_HREF, businessHref } from "@/components/routes";
import { businessSummaries } from "@/components/shell/shell-data";
import { Stamp } from "@/components/Stamp";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { placeOf, topWorkflows } from "@/components/view-helpers";
import { CASE_STUDIES } from "@/lib/domain/cases";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile } from "@/lib/domain/types";
import { listBusinesses } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// `/app`, the first page after sign-in: the viewer's own businesses with what
// waits on each, or a first-run empty state, then the three researched sample
// businesses with their headline number and top workflows.

export const metadata: Metadata = { title: "Your businesses" };

/** Say how many approvals wait, or that none do. */
function waitingText(pending: number | null): string {
  if (pending === null) return "Approvals unavailable";
  if (pending === 0) return "All caught up";
  return pending === 1 ? "1 approval waiting" : `${pending} approvals waiting`;
}

/** Render one of the viewer's businesses as a row linking to its overview. */
function OwnRow({ business, pending }: { readonly business: BusinessProfile; readonly pending: number | null }) {
  const place = placeOf(business);
  const workflowCount = Object.keys(business.workflows).length;
  return (
    <li>
      <Link className="biz-row" href={businessHref(business.id)}>
        <span className="biz-initial" aria-hidden="true">
          {business.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="biz-main">
          <b>{business.name}</b>
          <span>
            {business.trade}
            {place !== null && ` in ${place}`}. {workflowCount} workflows.
          </span>
        </span>
        <Badge tone={pending !== null && pending > 0 ? "new" : "neutral"}>{waitingText(pending)}</Badge>
        <ArrowRight className="biz-go" aria-hidden="true" size={18} />
      </Link>
    </li>
  );
}

/** Render one sample business card: its headline number and top three workflows. */
function SampleCard({ business }: { readonly business: BusinessProfile }) {
  return (
    <article className="case">
      <p className="who">{business.caseStudy?.label ?? business.trade}</p>
      <h3>
        <Link href={businessHref(business.id)} className="case-link">
          {business.name}
        </Link>
      </h3>
      {business.caseStudy && (
        <div>
          <p className="stat">{business.caseStudy.stat}</p>
          <p className="case-text">{business.caseStudy.statText}</p>
        </div>
      )}
      <ul>
        {topWorkflows(business, 3).map((w) => (
          <li key={w.id}>
            <span>{WORKFLOWS[w.id].name}</span>
            <Stamp path={w.plan.rec} />
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Render the business list. */
export default async function BusinessesPage() {
  const [businesses, summaries] = await Promise.all([listBusinesses(), businessSummaries()]);
  const pendingById = new Map(summaries.map((s) => [s.id, s.pending]));
  const own = businesses.filter((b) => b.kind === "custom");

  return (
    <>
      <PageHeader
        title="Your businesses"
        description="Open a business to see what needs you today, or map a new one in a few minutes of chat."
        actions={
          <ButtonLink href={NEW_BUSINESS_HREF}>
            <Plus aria-hidden="true" size={16} />
            Start a new business
          </ButtonLink>
        }
      />

      {own.length === 0 ? (
        <EmptyState
          icon={<Store size={22} />}
          title="Map your first business"
          actions={
            <>
              <ButtonLink href={NEW_BUSINESS_HREF}>Start a new business</ButtonLink>
              <ButtonLink href={businessHref("hvac")} variant="secondary">
                Explore a sample business
              </ButtonLink>
            </>
          }
        >
          Answer a few questions in chat. Anchored finds the work AI can take on, compares real tools against the ones
          you already use, and sets up agents that ask before they act.
        </EmptyState>
      ) : (
        <ul className="biz-list" aria-label="Your businesses">
          {own.map((business) => (
            <OwnRow key={business.id} business={business} pending={pendingById.get(business.id) ?? null} />
          ))}
        </ul>
      )}

      <section className="section" aria-labelledby="samples">
        <SectionHeader
          id="samples"
          title="Sample businesses"
          description="Three businesses we researched in depth. Explore freely: what you change stays in your session."
        />
        <div className="cases">
          {CASE_STUDIES.map((business) => (
            <SampleCard key={business.id} business={business} />
          ))}
        </div>
      </section>
    </>
  );
}
