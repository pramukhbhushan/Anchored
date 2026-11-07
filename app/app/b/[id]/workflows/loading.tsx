import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while your workflows load, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for your workflows. */
export default function WorkflowsLoading() {
  return <PageSkeleton layout="order" label="your workflows" />;
}
