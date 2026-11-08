import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TelegramQr, qrPath } from "./TelegramQr";

// =============================================================================
// Module Overview
// =============================================================================
// The QR code an owner shows customers: a real code for the exact link, with
// the quiet zone and the three corner finder squares every scanner looks for.

const LINK = "https://t.me/AnchoredDemoBot?start=dtrvzhdkf6kvdlrjjv4p3czn";

/** Read the dark squares back out of a path made by `qrPath`. */
function darkSquares(d: string): Set<string> {
  return new Set([...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(([, x, y]) => `${x},${y}`));
}

describe("qrPath", () => {
  it("draws a standard-size code with a four-module quiet zone for a business link", () => {
    const { size, d } = qrPath(LINK);
    // QR codes are 21 modules plus 4 per version; a link this long needs version 4.
    expect(size - 8).toBe(33);
    const dark = darkSquares(d);
    expect([...dark].every((key) => key.split(",").every((n) => Number(n) >= 4 && Number(n) < size - 4))).toBe(true);
  });

  it("draws the three finder squares in the corners", () => {
    const { size, d } = qrPath(LINK);
    const dark = darkSquares(d);
    const inner = size - 8;
    const corners: readonly (readonly [number, number])[] = [[4, 4], [4 + inner - 7, 4], [4, 4 + inner - 7]];
    for (const [x, y] of corners) {
      // Each finder is a dark 7x7 ring around a light ring around a dark 3x3 centre.
      expect(dark.has(`${x},${y}`)).toBe(true);
      expect(dark.has(`${x + 6},${y + 6}`)).toBe(true);
      expect(dark.has(`${x + 1},${y + 1}`)).toBe(false);
      expect(dark.has(`${x + 3},${y + 3}`)).toBe(true);
    }
  });

  it("draws a different code for a different business", () => {
    expect(qrPath(LINK).d).not.toBe(qrPath(LINK.replace("dtrv", "aaaa")).d);
  });
});

describe("TelegramQr", () => {
  it("shows a labelled image a screen reader can name", () => {
    render(<TelegramQr url={LINK} />);
    expect(screen.getByRole("img", { name: "QR code for your business's Telegram link" })).toBeInTheDocument();
  });
});
