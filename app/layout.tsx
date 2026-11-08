import type { Metadata, Viewport } from "next";
import { Archivo, Courier_Prime, Public_Sans, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFrame } from "@/components/site/SiteFrame";
import { ToastProvider } from "@/components/ui/Toast";
import { isAuthEnabled } from "@/lib/auth/config";
import { findViewer } from "@/lib/server/session";
import "./globals.css";

// =============================================================================
// Module Overview
// =============================================================================
// The root layout: fonts, the toast provider and `SiteFrame`, which draws the
// site header outside `/app` for whoever is signed in. Archivo keeps its `wdth`
// axis because the CSS stretches it from 72% to 125%; Schibsted Grotesk feeds `--body` and Courier Prime `--mono`.
// A saved light or dark choice from the landing page's toggle applies before paint.

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const publicSans = Public_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-public-sans",
  display: "swap",
});

// The landing page's faces (docs/brand.md): Schibsted Grotesk for text, Courier Prime for its ship's-log labels.
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier", display: "swap" });

// Apply a saved light or dark choice before the first paint, so the page doesn't flash the other theme.
const THEME_SCRIPT = `try{var t=localStorage.getItem("anchored-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "Anchored", template: "%s | Anchored" },
  description:
    "Describe any small business. Anchored finds the work AI can take on, rates real tools against the ones you already use, and builds approve-first agents where no tool fits.",
};

// The layout pads with safe-area insets, which are only nonzero under `viewport-fit=cover`.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEF3F6" },
    { media: "(prefers-color-scheme: dark)", color: "#07111F" },
  ],
};

/** Wrap every page in the fonts, the toast region and the site frame. */
export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const authEnabled = isAuthEnabled();
  // Only accounts need the visitor here; with them off the header never changes, so pages stay static.
  const viewer = authEnabled ? await findViewer() : null;
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${publicSans.variable} ${schibsted.variable} ${courier.variable}`}
      data-dev={process.env.NODE_ENV === "development" ? "" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>
          <SiteFrame authEnabled={authEnabled} viewer={viewer}>
            {children}
          </SiteFrame>
        </ToastProvider>
      </body>
    </html>
  );
}
