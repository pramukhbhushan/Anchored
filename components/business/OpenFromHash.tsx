"use client";

import { useEffect } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// Opens the `<details>` a URL hash names or sits in, such as `#wf-social` from
// the overview, `#how-we-score` on the tools page, or a decided card inside
// Approvals' history, and scrolls it into view. A browser scrolls to a hash
// target on its own but never opens a closed one.

/** Open and reveal the `<details>` whose id is the current hash. */
function openHashTarget(): void {
  let id: string;
  try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
  if (id === "") return;
  const target = document.getElementById(id);
  // The target is a `<details>`, or sits inside a closed one, such as a decided card in Approvals' history.
  const details = target instanceof HTMLDetailsElement ? target : target?.closest("details");
  if (!target || !details) return;
  details.open = true;
  // "auto" jumps rather than glides, which also suits owners who prefer less motion.
  target.scrollIntoView({ block: "start", behavior: "auto" });
}

/** Render nothing; open the hash's `<details>` on load and whenever the hash changes. */
export function OpenFromHash() {
  useEffect(() => {
    openHashTarget();
    window.addEventListener("hashchange", openHashTarget);
    return () => window.removeEventListener("hashchange", openHashTarget);
  }, []);
  return null;
}
