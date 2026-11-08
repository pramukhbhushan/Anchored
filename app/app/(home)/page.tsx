import { ArrowRight, Plus, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NEW_BUSINESS_HREF, businessHref } from "@/components/routes";
import { businessSummaries } from "@/components/shell/shell-data";
import { Stamp } from "@/components/ui/Stamp";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { placeOf, topWorkflows } from "@/components/view-helpers";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { BusinessProfile } from "@/lib/domain/types";
import { listBusinesses } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// `/app`, the first page after sign-in: the viewer's own businesses with what
// waits on each, or a first-run empty state, then the example business with
// its headline number and top workflows, marked as an example to explore.

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

/** Render the example business card: its headline number and top three workflows. */
function SampleCard({ business }: { readonly business: BusinessProfile }) {
  return (
    <article className="case case-wide">
      <p className="who">Example</p>
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
      {/* The title's link already covers the card; this says so where the eye lands, so it is hidden from screen readers. */}
      <p className="case-go" aria-hidden="true">
        Open the example
        <ArrowRight size={16} />
      </p>
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
  const samples = businesses.filter((b) => b.kind === "case");

  return (
    <>
      <PageHeader
        title="Your businesses"
        // With no business yet, the empty state below holds the one way to start, so the header doesn't repeat it.
        actions={
          own.length === 0 ? undefined : (
            <ButtonLink href={NEW_BUSINESS_HREF}>
              <Plus aria-hidden="true" size={16} />
              Start your own business
            </ButtonLink>
          )
        }
      />

      {own.length === 0 ? (
        <EmptyState
          icon={<Store size={22} />}
          title="Map your first business"
          actions={<ButtonLink href={NEW_BUSINESS_HREF}>Start your own business</ButtonLink>}
        >
          Answer a few questions in chat, and Anchored maps where AI can help. Until then, explore the example below.
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
          title="Example business"
          description="Explore it to see how Anchored works: change paths, approve cards and try an example event. What you change stays in your account and never reaches a real customer."
        />
        <div className="cases">
          {samples.map((business) => (
            <SampleCard key={business.id} business={business} />
          ))}
        </div>
      </section>
    </>
  );
}
