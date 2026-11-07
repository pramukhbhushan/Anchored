import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while onboarding loads, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for onboarding. */
export default function NewBusinessLoading() {
  return <PageSkeleton layout="chat" label="onboarding" />;
}
