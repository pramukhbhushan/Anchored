import { vi } from "vitest";

// =============================================================================
// Module Overview
// =============================================================================
// The network boundary for component tests. `stubFetch` replaces the global
// `fetch` with a spy that answers through a handler, so a test plays the API
// route; `json` builds the route's answer, `sentJson` reads back what a
// component sent, and `deferred` holds an answer until the test releases it.
// `test/setup-dom.ts` restores the real `fetch` after each test.

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

/** Replace `fetch` for this test with a spy that answers through `handler`. */
export function stubFetch(handler: Handler) {
  const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init)));
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

/** Return a JSON response, as an API route sends it. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Return the method, URL and parsed JSON body of the `index`th request `fetchSpy` saw. */
export function sentJson(fetchSpy: ReturnType<typeof stubFetch>, index: number): { method: string; url: string; body: unknown } {
  const call = fetchSpy.mock.calls[index];
  if (call === undefined) throw new Error(`fetch was called ${fetchSpy.mock.calls.length} times, not ${index + 1}`);
  const [input, init] = call;
  const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
  return { method: init?.method ?? "GET", url: String(input), body };
}

/** Return a promise the test settles by hand, to hold a request in flight. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
