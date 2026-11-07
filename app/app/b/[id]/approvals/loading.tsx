import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while your approvals load, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for your approvals. */
export default function ApprovalsLoading() {
  return <PageSkeleton layout="list" label="your approvals" />;
}
