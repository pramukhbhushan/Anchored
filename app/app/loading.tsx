import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while your businesses load, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for your businesses. */
export default function BusinessesLoading() {
  return <PageSkeleton layout="list" label="your businesses" />;
}
