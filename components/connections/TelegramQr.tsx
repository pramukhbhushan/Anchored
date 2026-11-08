import "server-only";
import QRCode from "qrcode";

// =============================================================================
// Module Overview
// =============================================================================
// A QR code for a business's Telegram link, drawn on the server as one SVG
// path from the code's dark modules. The link never leaves the server for an
// outside image service, and no HTML string is injected into the page. A
// customer scans it with a phone camera to open the business's chat.

/** The quiet zone, in modules, that scanners need around the code. */
const MARGIN = 4;

/** Return the SVG path that draws each dark module of `text`'s QR code as a 1x1 square, and the code's size in modules. */
export function qrPath(text: string): { readonly size: number; readonly d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const parts: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) parts.push(`M${col + MARGIN} ${row + MARGIN}h1v1h-1z`);
    }
  }
  return { size: modules.size + MARGIN * 2, d: parts.join("") };
}

/** Draw the QR code for one Telegram link, dark on white so every phone camera reads it in either theme. */
export function TelegramQr({ url }: { readonly url: string }) {
  const { size, d } = qrPath(url);
  return (
    <svg role="img" aria-label="QR code for your business's Telegram link" viewBox={`0 0 ${size} ${size}`} width="176" height="176" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
