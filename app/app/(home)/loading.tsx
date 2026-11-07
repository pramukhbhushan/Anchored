import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while your businesses load, shaped like the page so nothing jumps when it arrives.
// It sits in the `(home)` route group so it wraps only `/app`: a boundary in `app/app/`
// would also wrap `b/[id]/layout.tsx`, and a missing business would stream as a 200.

/** Render the placeholder for your businesses. */
export default function BusinessesLoading() {
  return <PageSkeleton layout="list" label="your businesses" />;
}
