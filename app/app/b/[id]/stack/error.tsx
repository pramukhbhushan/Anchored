"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when your stack fails to load, with a retry and a way back.

/** Render the error for your stack, with a retry. */
export default function StackError(props: RouteErrorProps) {
  return <RouteError {...props} title="Your stack didn't load" />;
}
