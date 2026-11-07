"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when your businesses fail to load, with a retry and a way back.

/** Render the error for your businesses, with a retry. */
export default function BusinessesError(props: RouteErrorProps) {
  return <RouteError {...props} title="Your businesses didn't load" />;
}
