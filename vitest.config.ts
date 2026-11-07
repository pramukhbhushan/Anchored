import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// =============================================================================
// Module Overview
// =============================================================================
// Vitest settings. Tests live beside the code and resolve the same `@/` alias
// the app uses. Two projects split them by extension: `*.test.ts` covers pure
// logic in node, and `*.test.tsx` renders components in happy-dom with the
// setup in `test/setup-dom.ts`.

export default defineConfig({
  // `tsconfig.json` leaves JSX to Next (`"jsx": "preserve"`), so the tests compile it themselves, the way React 19 does.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./lib/test-stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.ts", "middleware.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: ["components/**/*.test.tsx", "app/**/*.test.tsx"],
          environment: "happy-dom",
          setupFiles: ["./test/setup-dom.ts"],
        },
      },
    ],
  },
});
