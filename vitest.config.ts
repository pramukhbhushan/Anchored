import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// =============================================================================
// Module Overview
// =============================================================================
// Vitest settings. Tests live beside the code as `*.test.ts` and resolve the
// same `@/` alias the app uses.

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./lib/test-stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.ts", "middleware.test.ts"],
    environment: "node",
  },
});
