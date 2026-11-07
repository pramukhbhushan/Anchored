"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when the profile fails to load, with a retry and a way back.

/** Render the error for the profile, with a retry. */
export default function ProfileError(props: RouteErrorProps) {
  return <RouteError {...props} title="The profile didn't load" />;
}
