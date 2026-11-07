import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetNavigation } from "@/test/next";

// =============================================================================
// Module Overview
// =============================================================================
// Runs before every component test file: adds the jest-dom matchers such as
// `toBeDisabled`, swaps `next/navigation` for the spies in `test/next.ts`, and
// after each test unmounts what it rendered and undoes its spies and stubs, so
// no test sees another's DOM, router calls, `fetch` or saved widths.

vi.mock("next/navigation", async () => (await import("@/test/next")).navigation);

afterEach(() => {
  cleanup();
  resetNavigation();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
