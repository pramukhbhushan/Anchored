"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui/RouteError";

// =============================================================================
// Module Overview
// =============================================================================
// The last error boundary inside the root layout. It catches what the `/app`
// boundaries can't, such as the app shell's own layout failing when a session
// lapses, so Next's default error page never shows.

/** Render the error with a retry, a way back and a sign-in link. */
export default function RootError(props: RouteErrorProps) {
  return (
    <div className="wrap solo">
      <RouteError {...props} title="This page didn't load" signIn />
    </div>
  );
}
