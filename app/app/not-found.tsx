import { SearchX } from "lucide-react";
import { APP_HREF, NEW_BUSINESS_HREF } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// =============================================================================
// Module Overview
// =============================================================================
// The 404 inside the app shell, shown when a business page's id matches
// nothing the viewer can open, so the sidebar stays in reach.

/** Render the missing-business page. */
export default function BusinessNotFound() {
  return (
    <EmptyState
      icon={<SearchX size={22} />}
      title="We couldn't find that business"
      actions={
        <>
          <ButtonLink href={APP_HREF}>All businesses</ButtonLink>
          <ButtonLink href={NEW_BUSINESS_HREF} variant="secondary">
            Start a new business
          </ButtonLink>
        </>
      }
    >
      It may have been deleted when the demo was reset, or it belongs to another account.
    </EmptyState>
  );
}
