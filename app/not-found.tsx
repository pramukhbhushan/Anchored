import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// =============================================================================
// Module Overview
// =============================================================================
// The site's 404: what probably happened and two ways forward, starting over
// with a new business or looking at the case studies.

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
            <ButtonLink href={NEW_BUSINESS_HREF}>Start over</ButtonLink>
            <ButtonLink href="/#cases" variant="secondary">
              See the case studies
            </ButtonLink>
          </>
        }
      >
        The link may be old, or the business was deleted when the demo was reset.
      </EmptyState>
    </div>
  );
}
