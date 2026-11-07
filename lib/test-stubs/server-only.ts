// =============================================================================
// Module Overview
// =============================================================================
// Stand-in for the `server-only` package under Vitest. The real package throws
// outside Next.js's server build, which would stop server modules from loading
// in tests; Next.js still enforces the boundary in the app.

export {};
