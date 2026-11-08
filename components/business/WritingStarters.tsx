"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// `WritingStarters`: the line Approvals shows while Anchored writes a business's
// starter drafts after the page loaded. It reloads the page's data every few
// seconds, so the written drafts replace the templates without a manual reload.

// The model usually answers within a few seconds; after about half a minute the templates simply stay.
const RELOAD_EVERY_MS = 4000;
const MOST_RELOADS = 8;

/** Say that drafts for `businessName` are being written, and reload the page's data until they land or time runs out. */
export function WritingStarters({ businessName }: { readonly businessName: string }) {
  const router = useRouter();
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (reloads >= MOST_RELOADS) return;
    const timer = setTimeout(() => {
      setReloads((count) => count + 1);
      router.refresh();
    }, RELOAD_EVERY_MS);
    return () => clearTimeout(timer);
  }, [reloads, router]);

  if (reloads >= MOST_RELOADS) return null;
  return (
    <p className="fine" role="status">
      Writing example drafts for {businessName}. They replace these in a moment.
    </p>
  );
}
