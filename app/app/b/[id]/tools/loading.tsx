import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while rated tools load, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for rated tools. */
export default function ToolsLoading() {
  return <PageSkeleton layout="rows" label="rated tools" />;
}
