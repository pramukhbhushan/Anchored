import type { ApiError } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// The `fetch` wrappers the client components use to call Anchored's API routes.
// `callApi` writes and `getApi` reads; each returns the parsed body or throws an
// `ApiCallError` whose message is safe to show the owner as is and whose
// `status` callers can branch on.

const OFFLINE_MESSAGE = "Couldn't reach Anchored. Check your connection and try again.";
const SERVER_MESSAGE = "Something went wrong on our side. Try again in a moment.";

/** A failed API call: a plain-words `message` plus the HTTP `status`, or `0` when the request never arrived. */
export class ApiCallError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiCallError";
    this.status = status;
  }
}

/** Narrow a response body to the `ApiError` shape every route returns on failure. */
function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

/** Send `body` as JSON to an API route and return the parsed response, or throw an `ApiCallError`. */
export async function callApi<T>(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  return request<T>(url, init, OFFLINE_MESSAGE, SERVER_MESSAGE);
}

/** GET an API route's JSON, never from the HTTP cache. `failMessage` stands in when the route gives no reason. */
export async function getApi<T>(url: string, failMessage: string): Promise<T> {
  return request<T>(url, { cache: "no-store" }, failMessage, failMessage);
}

/** Fetch `url` and return its JSON body, or throw an `ApiCallError` with the route's reason or a fallback. */
async function request<T>(url: string, init: RequestInit, offlineMessage: string, serverMessage: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new ApiCallError(offlineMessage, 0, { cause });
  }
  // A crashed route can answer with HTML, so a body that isn't JSON counts as no body.
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiCallError(isApiError(data) ? data.error : serverMessage, response.status);
  }
  // The routes and these callers compile against the same `lib/api/contract.ts` shapes.
  return data as T;
}

/** Return the message of a thrown value, falling back to a generic plain-words one. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : SERVER_MESSAGE;
}
