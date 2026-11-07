"use client";

import { useEffect } from "react";

// =============================================================================
// Module Overview
// =============================================================================
// Opens the `<details>` a URL hash names, such as `#wf-social` from the
// overview or `#how-we-score` on the tools page, and scrolls it into view. A
// browser scrolls to a hash target on its own but never opens a closed one.

/** Open and reveal the `<details>` whose id is the current hash. */
function openHashTarget(): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (id === "") return;
  const target = document.getElementById(id);
  if (!(target instanceof HTMLDetailsElement)) return;
  target.open = true;
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
