import { PageSkeleton } from "@/components/ui/Skeleton";

// =============================================================================
// Module Overview
// =============================================================================
// Shown while the chat loads, shaped like the page so nothing jumps when it arrives.

/** Render the placeholder for the chat. */
export default function ChatLoading() {
  return <PageSkeleton layout="chat" label="the chat" />;
}
