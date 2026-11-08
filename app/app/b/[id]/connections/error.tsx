"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when your connections fail to load, with a retry and a way back.

/** Render the error for your connections, with a retry. */
export default function ConnectionsError(props: RouteErrorProps) {
  return <RouteError {...props} title="Your connections didn't load" />;
}
