import { Badge } from "@/components/ui/Badge";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The one "Example" label in the app's top bar: a pill beside the business
// switcher while the example business is open, so nobody mistakes it for
// their own. At phone width the top bar's title says "(example)" instead.

/** Render the pill for the example business, or nothing for the owner's own business. */
export function SampleBadge({ business }: { readonly business: Pick<BusinessProfile, "kind"> }) {
  if (business.kind !== "case") return null;
  return (
    <Badge tone="info" className="sample-pill">
      Example
    </Badge>
  );
}
