import { Badge } from "@/components/ui/Badge";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The one "Sample" label in the app: a pill in the top bar beside the business
// switcher while a researched case study is open, so nobody mistakes a sample
// for their own. At phone width the top bar's title says "(sample)" instead.

/** Render the pill for a case study, or nothing for the owner's own business. */
export function SampleBadge({ business }: { readonly business: Pick<BusinessProfile, "kind"> }) {
  if (business.kind !== "case") return null;
  return (
    <Badge tone="info" className="sample-pill">
      Sample
    </Badge>
  );
}
