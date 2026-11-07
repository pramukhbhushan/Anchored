// =============================================================================
// Module Overview
// =============================================================================
// Loading placeholders. `Skeleton` is one grey block; `PageSkeleton` lays out
// blocks in the shape of a page, using the page's own grid classes, so the
// real content lands where the placeholder was and nothing jumps.

/** The page shapes a `loading.tsx` can ask for. */
export type SkeletonLayout = "overview" | "cards" | "list" | "stack" | "chat" | "profile";

/** Render one placeholder block of `width` by `height`. */
function Skeleton({
  width = "100%",
  height = 14,
  className,
}: {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly className?: string;
}) {
  return <span className={`skel${className ? ` ${className}` : ""}`} style={{ width, height }} aria-hidden="true" />;
}

/** Render a block shaped like a card: a title line and two lines of text. */
function SkeletonCard({ height = 132 }: { readonly height?: number }) {
  return (
    <div className="panel skel-card" style={{ minHeight: height }}>
      <Skeleton width="45%" height={18} />
      <Skeleton width="90%" />
      <Skeleton width="70%" />
    </div>
  );
}

/** Render `count` cards of `height` in the independent-cards grid. */
function CardGrid({ count, height }: { readonly count: number; readonly height: number }) {
  return (
    <div className="grid-cards">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </div>
  );
}

/** Render the body for one `layout`. */
function SkeletonBody({ layout }: { readonly layout: SkeletonLayout }) {
  switch (layout) {
    case "overview":
      return (
        <div className="with-rail">
          <div className="ov-main">
            <SkeletonCard height={220} />
            <Skeleton height={84} />
            <CardGrid count={2} height={200} />
          </div>
          <div className="rail">
            <SkeletonCard height={220} />
            <SkeletonCard height={200} />
          </div>
        </div>
      );
    case "cards":
      return <CardGrid count={6} height={260} />;
    case "list":
      return <CardGrid count={6} height={180} />;
    case "stack":
      // The monthly bill with free help beside it, then the "How work moves" lanes.
      return (
        <>
          <div className="with-rail">
            <SkeletonCard height={240} />
            <SkeletonCard height={200} />
          </div>
          <div className="section">
            <div className="section-head">
              <Skeleton width={180} height={22} />
            </div>
            <CardGrid count={3} height={220} />
          </div>
        </>
      );
    case "chat":
      return (
        <div className="panel skel-card skel-chat">
          <Skeleton width="60%" height={44} />
          <Skeleton width="40%" height={44} className="skel-right" />
          <Skeleton width="55%" height={44} />
        </div>
      );
    case "profile":
      return (
        <div className="prof-page">
          <SkeletonCard height={460} />
          <SkeletonCard height={460} />
        </div>
      );
  }
}

/** Render a loading page: a header placeholder, then the body for `layout`. Announces `label` to screen readers. */
export function PageSkeleton({ layout, label }: { readonly layout: SkeletonLayout; readonly label: string }) {
  return (
    <div className="skel-page" role="status" aria-live="polite">
      <span className="sr">Loading {label}</span>
      <div className="page-head" aria-hidden="true">
        <div className="page-head-text">
          <Skeleton width={220} height={30} />
          <Skeleton width="min(520px, 90%)" height={14} />
        </div>
      </div>
      <div aria-hidden="true">
        <SkeletonBody layout={layout} />
      </div>
    </div>
  );
}
