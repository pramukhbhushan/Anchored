import { Badge } from "@/components/ui/Badge";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The "Sample business" label every business page puts beside its title when
// the business is one of the researched case studies, so nobody mistakes a
// sample for their own.

/** Render the label for a case study, or nothing for the owner's own business. */
export function SampleBadge({ business }: { readonly business: Pick<BusinessProfile, "kind"> }) {
  if (business.kind !== "case") return null;
  return <Badge tone="info">Sample business</Badge>;
}
