import { PATH_LABEL } from "@/lib/domain/workflows";
import type { PathKind } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The two small marks every workflow view uses: `Stamp`, the rubber-stamp
// verdict for a path, and `FitBar`, three ticks for how well a workflow fits.
// Both are plain markup, safe in server and client components.

/** Render the rubber-stamp label for `path`; `fresh` plays the thunk animation. */
export function Stamp({ path, fresh = false }: { readonly path: PathKind; readonly fresh?: boolean }) {
  return <span className={`stamp ${path}${fresh ? " fresh" : ""}`}>{PATH_LABEL[path]}</span>;
}

/** Render three ticks with the first `fit` filled. */
export function FitBar({ fit }: { readonly fit: number }) {
  return (
    <span className="fitbar" role="img" aria-label={`Fit ${fit} of 3`}>
      {[1, 2, 3].map((tick) => (
        <span key={tick} className={tick <= fit ? "on" : ""} />
      ))}
    </span>
  );
}
