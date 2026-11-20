import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { NEW_BUSINESS_HREF, businessHref } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";

// =============================================================================
// Module Overview
// =============================================================================
// The site's 404: what probably happened and two ways forward, setting up a
// business or exploring the example.

export const metadata: Metadata = { title: "Page not found" };

/** Render the not-found page. */
export default function NotFound() {
  return (
    <div className="wrap solo">
      <EmptyState
        icon={<SearchX size={22} />}
        title="We couldn't find that page"
        actions={
          <>
            <ButtonLink href={NEW_BUSINESS_HREF}>Set up your business</ButtonLink>
            <ButtonLink href={businessHref(SAMPLE_BUSINESS.id)} variant="secondary">
              Explore the example
            </ButtonLink>
          </>
        }
      >
        The link may be old, or the page may have moved.
      </EmptyState>
    </div>
  );
}
