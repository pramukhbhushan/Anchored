import type { Metadata, Viewport } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFrame } from "@/components/SiteFrame";
import { ToastProvider } from "@/components/Toast";
import { isAuthEnabled } from "@/lib/auth/config";
import "./globals.css";

// =============================================================================
// Module Overview
// =============================================================================
// The root layout: fonts, the toast provider and `SiteFrame`, which draws the
// site header outside `/app`. Archivo keeps its `wdth` axis because the CSS
// stretches it from 72% to 125%; both fonts feed `--display` and `--body`.

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const publicSans = Public_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Anchored", template: "%s | Anchored" },
  description:
    "Describe any small business. Anchored finds the work AI can take on, rates real tools against the ones you already use, and builds approve-first agents where no tool fits.",
};

// The layout pads with safe-area insets, which are only nonzero under `viewport-fit=cover`.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDF0EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E131B" },
  ],
};

/** Wrap every page in the fonts, the toast region and the site frame. */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${publicSans.variable}`} data-dev={process.env.NODE_ENV === "development" ? "" : undefined}>
      <body>
        <ToastProvider>
          <SiteFrame authEnabled={isAuthEnabled()}>{children}</SiteFrame>
        </ToastProvider>
      </body>
    </html>
  );
}
