"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// Shown when the chat fails to load, with a retry and a way back.

/** Render the error for the chat, with a retry. */
export default function ChatError(props: RouteErrorProps) {
  return <RouteError {...props} title="The chat didn't load" />;
}
