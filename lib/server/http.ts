import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiError } from "@/lib/api/contract";
import { NotFoundError } from "@/lib/store";

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

/** Parse the request body against `schema`, or return the 400 response to send instead. */
export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse<ApiError> }> {
  let raw: unknown;
  try {
    const text = await request.text();
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
  console.error(`[API ${route}] Unexpected error:`, error);
  return fail(500, "Something went wrong on our side. Try again in a moment.");
}
