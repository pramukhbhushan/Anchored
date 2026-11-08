import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// =============================================================================
// Module Overview
// =============================================================================
// The site's 404: what probably happened and two ways forward, starting over
// with a new business or exploring the example.

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
            <ButtonLink href="/#example" variant="secondary">
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
