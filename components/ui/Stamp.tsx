import { PATH_LABEL } from "@/lib/domain/workflows";
import type { PathKind } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// `Stamp`, the rubber-stamp verdict for a path that every workflow view uses:
// one stamp per workflow, at the decision. Plain markup, safe in server and
// client components.

/** Render the rubber-stamp label for `path`; `fresh` plays the thunk animation. */
export function Stamp({ path, fresh = false }: { readonly path: PathKind; readonly fresh?: boolean }) {
  return <span className={`stamp ${path}${fresh ? " fresh" : ""}`}>{PATH_LABEL[path]}</span>;
}
