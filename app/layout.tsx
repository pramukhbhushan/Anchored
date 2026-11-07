import type { Metadata, Viewport } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

// =============================================================================
// Module Overview
// =============================================================================
// The root layout: fonts, the sticky top bar with the Anchored mark and main
// nav, and the toast provider. Archivo keeps its `wdth` axis because the CSS
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
export const viewport: Viewport = { viewportFit: "cover" };

/** Wrap every page in the top bar and the toast region. */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${publicSans.variable}`}>
      <body>
        <ToastProvider>
          <header className="top">
            <div className="wrap">
              <Link className="mark" href="/" aria-label="Anchored home">
                <svg
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
                Anchored
              </Link>
              <TopNav />
            </div>
          </header>
          <main id="main">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
