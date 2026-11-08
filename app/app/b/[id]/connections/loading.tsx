import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while your connections load, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for your connections. */
export default function ConnectionsLoading() {
  return <PageSkeleton layout="list" label="your connections" />;
}
