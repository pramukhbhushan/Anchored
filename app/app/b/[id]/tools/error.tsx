"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when rated tools fail to load, with a retry and a way back.

/** Render the error for rated tools, with a retry. */
export default function ToolsError(props: RouteErrorProps) {
  return <RouteError {...props} title="The tools didn't load" />;
}
