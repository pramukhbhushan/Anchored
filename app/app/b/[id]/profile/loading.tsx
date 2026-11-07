import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while the profile loads, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for the profile. */
export default function ProfileLoading() {
  return <PageSkeleton layout="profile" label="the profile" />;
}
