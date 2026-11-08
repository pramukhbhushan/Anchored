import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// A familiar page placeholder while an agent or nested automation loads.

/** Render the agent workspace loading state. */
export default function AgentLoading() {
  return <PageSkeleton layout="feed" label="your agent" />;
}
