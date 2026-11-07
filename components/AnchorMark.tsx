// =============================================================================
// Module Overview
// =============================================================================
// The anchor glyph from the wordmark, drawn in `currentColor`. The site header,
// the app sidebar and the top bar share it; `app/icon.svg` repeats its paths.

/** Render the anchor glyph at `size` pixels, hidden from screen readers. */
export function AnchorMark({ size = 22 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2.4" />
      <path d="M12 7.5V21M7 11h10M4 14c0 4 3.6 7 8 7s8-3 8-7" />
    </svg>
  );
}
