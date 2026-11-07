import type { NextConfig } from "next";

// =============================================================================
// Module Overview
// =============================================================================
// Next.js settings for Anchored. The app runs on Vercel defaults, and every
// secret comes from environment variables. `headers` adds browser security
// headers to every response, with HSTS and a Content-Security-Policy in production.

type Header = { readonly key: string; readonly value: string };

const SECURITY_HEADERS: readonly Header[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Next's inline hydration scripts and inline styles need 'unsafe-inline'.
// `next/font/google` self-hosts the fonts at build time, so `font-src 'self'` covers them.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// The dev server evaluates code with `eval`, which this policy would block, so
// HSTS and the CSP apply only to production builds.
const PRODUCTION_HEADERS: readonly Header[] = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

const config: NextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS, ...(isProduction ? PRODUCTION_HEADERS : [])] }];
  },
};

export default config;
