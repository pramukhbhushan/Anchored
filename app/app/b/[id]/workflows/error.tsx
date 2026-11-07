"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when your workflows fail to load, with a retry and a way back.

/** Render the error for your workflows, with a retry. */
export default function WorkflowsError(props: RouteErrorProps) {
  return <RouteError {...props} title="Your workflows didn't load" />;
}
