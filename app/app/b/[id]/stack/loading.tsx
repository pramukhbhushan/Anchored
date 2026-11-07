import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while your stack loads, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for your stack. */
export default function StackLoading() {
  return <PageSkeleton layout="stack" label="your stack" />;
}
