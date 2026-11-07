import type { ApiError } from "@/lib/api/contract";

// =============================================================================
// Module Overview
// =============================================================================
// The one `fetch` wrapper the client components use to call Anchored's API
// routes. `callApi` returns the parsed body or throws an `ApiCallError` whose
// message is safe to show the owner as is and whose `status` callers can branch on.

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
export async function callApi<T>(url: string, method: "POST" | "PUT", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiCallError(OFFLINE_MESSAGE, 0, { cause });
  }
  // A crashed route can answer with HTML, so a body that isn't JSON counts as no body.
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiCallError(isApiError(data) ? data.error : SERVER_MESSAGE, response.status);
  }
  // The routes and these callers compile against the same `lib/api/contract.ts` shapes.
  return data as T;
}

/** Return the message of a thrown value, falling back to a generic plain-words one. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : SERVER_MESSAGE;
}
