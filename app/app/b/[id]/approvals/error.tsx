"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when your approvals fail to load, with a retry and a way back.

/** Render the error for your approvals, with a retry. */
export default function ApprovalsError(props: RouteErrorProps) {
  return <RouteError {...props} title="Your approvals didn't load" />;
}
