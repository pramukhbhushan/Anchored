"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when onboarding fails to load, with a retry and a way back.

/** Render the error for onboarding, with a retry. */
export default function NewBusinessError(props: RouteErrorProps) {
  return <RouteError {...props} title="Onboarding didn't load" />;
}
