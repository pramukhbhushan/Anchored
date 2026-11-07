"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { APP_HREF } from "@/components/routes";
import { loginHref } from "@/lib/auth/paths";

// =============================================================================
// Module Overview
// =============================================================================
// What an `error.tsx` under `/app` renders: what failed, a "Try again" that
// refetches the server data before re-rendering, and a way back to the list
// of businesses. Each route's `error.tsx` passes its own `title`.

/** The props Next passes to every `error.tsx`. */
export interface RouteErrorProps {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}

/** Render the failure, a retry and a way out; `signIn` adds a sign-in link for errors that can mean a lapsed session. */
export function RouteError({
  error,
  reset,
  title,
  signIn = false,
}: RouteErrorProps & { readonly title: string; readonly signIn?: boolean }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    // The audit trail for a page that failed in the browser; server failures are already in the server log.
    console.error("[RouteError]", error);
  }, [error]);

  function retry() {
    // `reset` alone re-renders with the same failed server payload; refreshing first fetches it again.
    startRetry(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="route-error" role="alert">
      <h1 className="page-title">{title}</h1>
      <p className="page-desc">
        Anchored couldn&apos;t load this page. Your businesses and choices are still saved. Try again, and if it keeps
        failing, go back to your businesses.
      </p>
      <div className="row">
        <Button onClick={retry} disabled={retrying}>
          <RotateCw aria-hidden="true" size={16} />
          {retrying ? "Trying again..." : "Try again"}
        </Button>
        <ButtonLink href={APP_HREF} variant="secondary">
          Back to your businesses
        </ButtonLink>
        {signIn && (
          <ButtonLink href={loginHref(APP_HREF)} variant="quiet">
            Sign in again
          </ButtonLink>
        )}
      </div>
      {error.digest !== undefined && <p className="fine">Error reference {error.digest}</p>}
    </div>
  );
}
