"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi, errorText } from "@/components/api";
import { useToast } from "@/components/Toast";

// =============================================================================
// Module Overview
// =============================================================================
// The small "Reset demo" button in the app bar. It clears this session's
// businesses, choices and cards through `/api/reset`, then returns to the
// landing page.

/** Render the reset button and run the reset on click. */
export function ResetDemoButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      await callApi<{ ok: true }>("/api/reset", "POST");
      toast("Demo reset");
      // No `router.refresh()`: it would re-render this business page, which may no longer exist.
      // Next 15 refetches dynamic pages on every visit, so the next business page is fresh anyway.
      router.push("/");
    } catch (error) {
      toast(errorText(error));
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn sm ghost" onClick={reset} disabled={busy}>
      Reset demo
    </button>
  );
}
