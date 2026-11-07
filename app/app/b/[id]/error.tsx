"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when the overview fails to load, with a retry and a way back.

/** Render the error for the overview, with a retry. */
export default function OverviewError(props: RouteErrorProps) {
  return <RouteError {...props} title="The overview didn't load" />;
}
