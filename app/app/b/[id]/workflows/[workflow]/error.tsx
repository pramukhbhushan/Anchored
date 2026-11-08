"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Retains the app shell when an agent workspace fails and provides a retry.

/** Render a recoverable workspace error. */
export default function AgentError(props: RouteErrorProps) {
  return <RouteError {...props} title="This workspace didn't load" />;
}
