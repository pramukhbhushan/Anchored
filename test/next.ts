import { vi } from "vitest";

// =============================================================================
// Module Overview
// =============================================================================
// A stand-in for `next/navigation` in component tests, which have no Next app
// router to mount. `test/setup-dom.ts` mocks the module with `navigation`, so
// every test reads the same `router` spies and sets where the viewer is with
// `setLocation`. `resetNavigation` runs after each test.

/** The router every `useRouter()` call returns; assert on its spies, such as `router.push`. */
export const router = {
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
  back: vi.fn<() => void>(),
  forward: vi.fn<() => void>(),
  prefetch: vi.fn<(href: string) => void>(),
};

interface Location {
  /** What `usePathname` returns, such as `/app/b/rosa/tools`. */
  readonly pathname: string;
  /** What `useSelectedLayoutSegments` returns below the `/app` layout, such as `["b", "rosa", "tools"]`. */
  readonly segments: readonly string[];
  /** What `useSearchParams` returns, such as `workflow=calls`. */
  readonly search: string;
}

const HOME: Location = { pathname: "/app", segments: [], search: "" };

let current: Location = HOME;

/** Put the viewer at `next`; fields left out keep their value. Call before rendering. */
export function setLocation(next: Partial<Location>): void {
  current = { ...current, ...next };
}

/** Clear the router spies and return the viewer to `/app`. */
export function resetNavigation(): void {
  for (const spy of Object.values(router)) spy.mockReset();
  current = HOME;
}

/** The mocked module's exports, limited to the hooks Anchored's components call. */
export const navigation = {
  useRouter: () => router,
  usePathname: () => current.pathname,
  useSearchParams: () => new URLSearchParams(current.search),
  useSelectedLayoutSegments: () => [...current.segments],
};
