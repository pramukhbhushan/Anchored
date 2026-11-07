import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiError } from "@/lib/api/contract";
import { NotFoundError } from "@/lib/store";
import { SignInRequiredError } from "./session";

// =============================================================================
// Module Overview
// =============================================================================
// Small helpers every API route shares: JSON responses, error bodies in the
// `ApiError` shape, request parsing against a Zod schema, and one place that
// turns unexpected errors into a logged 500.

/** Return `data` as JSON with `status`. */
export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/** Return an `ApiError` body with a message the owner can act on. */
export function fail(status: number, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

/** Largest body a route reads. Matches the middleware's cap on declared lengths. */
const MAX_BODY_BYTES = 64 * 1024;

/** Read the body as text, stopping at `MAX_BODY_BYTES`, or return `null` when it is larger. */
async function readCapped(request: Request): Promise<string | null> {
  // A chunked body declares no length, so the middleware's check can't see it; count bytes as they arrive.
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Parse the request body against `schema`, or return the 400, 413 or 415 response to send instead. */
export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse<ApiError> }> {
  const text = await readCapped(request);
  if (text === null) return { ok: false, response: fail(413, `This request is too large. Keep it under ${MAX_BODY_BYTES / 1024} KB.`) };
  // Only JSON is accepted, which also keeps simple cross-site form posts out.
  if (text && !(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return { ok: false, response: fail(415, "Send the request as JSON (`Content-Type: application/json`).") };
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: fail(400, "The request body is not valid JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length ? ` (${first.path.join(".")})` : "";
    return { ok: false, response: fail(400, `${first?.message ?? "Invalid request."}${where}`) };
  }
  return { ok: true, data: parsed.data };
}

/** Turn an unexpected error into a logged 500, or a 404 for a missing record. */
export function handleError(error: unknown, route: string): NextResponse<ApiError> {
  if (error instanceof NotFoundError) return fail(404, error.message);
  if (error instanceof SignInRequiredError) return fail(401, error.message);
  console.error(`[API ${route}] Unexpected error:`, error);
  return fail(500, "Something went wrong on our side. Try again in a moment.");
}
