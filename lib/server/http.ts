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
/** Read the body's bytes, or `null` once it passes `max`. A chunked body declares no length, so count bytes as they arrive. */
export async function readBytesCapped(request: Request, max: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function readCapped(request: Request): Promise<string | null> {
  const bytes = await readBytesCapped(request, MAX_BODY_BYTES);
  return bytes === null ? null : new TextDecoder().decode(bytes);
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
    return { ok: false, response: fail(400, first === undefined ? "Invalid request." : describeIssue(first, raw, [])) };
  }
  return { ok: true, data: parsed.data };
}

// =============================================================================
// Readable validation errors
// =============================================================================

type Issue = z.core.$ZodIssue;
type IssuePath = readonly PropertyKey[];

/** Owner words for the types Zod names in an `invalid_type` issue. */
const TYPE_WORDS: Readonly<Partial<Record<string, string>>> = {
  string: "text",
  number: "a number",
  int: "a whole number",
  boolean: "true or false",
  object: "an object",
  array: "a list",
};

/** The value at `path` inside `value`, or `undefined` when a step is missing. */
function valueAt(value: unknown, path: IssuePath): unknown {
  let at = value;
  for (const key of path) {
    if (typeof at !== "object" || at === null) return undefined;
    at = (at as Record<PropertyKey, unknown>)[key];
  }
  return at;
}

/** Join choices as "a", "a or b", or "a, b or c". */
function orList(choices: readonly string[]): string {
  return choices.length <= 1 ? (choices[0] ?? "") : `${choices.slice(0, -1).join(", ")} or ${choices.at(-1)}`;
}

/** Say what to fix for `issue`, whose path is relative to `base` inside the parsed body `raw`, in one short sentence. */
function describeIssue(issue: Issue, raw: unknown, base: IssuePath): string {
  const path = [...base, ...issue.path];
  const name = path.map(String).join(".");
  const field = name === "" ? "The request" : `\`${name}\``;
  switch (issue.code) {
    case "invalid_union":
      return describeUnion(issue.errors, raw, path) ?? issue.message;
    case "invalid_value":
      return `${field} must be ${orList(issue.values.map(String))}.`;
    case "invalid_type":
      return valueAt(raw, path) === undefined ? `${field} is missing.` : `${field} must be ${TYPE_WORDS[issue.expected] ?? issue.expected}.`;
    default:
      // Other issues carry a message the schema wrote for owners, or a size limit Zod states plainly.
      return name === "" ? issue.message : `${issue.message} (${name})`;
  }
}

type ValueIssue = Extract<Issue, { code: "invalid_value" }>;

function isValueIssue(issue: Issue): issue is ValueIssue {
  return issue.code === "invalid_value";
}

/** Describe a union failure through the shape the body came closest to, or `null` when no shape reported a problem. */
function describeUnion(branches: readonly (readonly Issue[])[], raw: unknown, path: IssuePath): string | null {
  // A wrong literal means the body chose another shape; a present value of the wrong type is the next worst; a missing field is closest.
  const ranked = branches
    .filter((issues) => issues.length > 0)
    .map((issues) => ({
      issues,
      literals: issues.filter(isValueIssue).length,
      types: issues.filter((issue) => issue.code === "invalid_type" && valueAt(raw, [...path, ...issue.path]) !== undefined).length,
    }))
    .sort((a, b) => a.literals - b.literals || a.types - b.types);
  const best = ranked[0];
  if (best === undefined) return null;
  const tied = ranked.filter((branch) => branch.literals === best.literals && branch.types === best.types);
  const literals = tied.flatMap((branch) => branch.issues.find(isValueIssue) ?? []);
  const key = (issue: Issue) => issue.path.map(String).join(".");
  const [lead] = literals;
  // When every closest shape wants its own value in the same field, such as `decision`, offer all of them.
  if (tied.length > 1 && lead !== undefined && literals.length === tied.length && literals.every((issue) => key(issue) === key(lead))) {
    const merged: ValueIssue = { ...lead, values: [...new Set(literals.flatMap((issue) => issue.values))] };
    return describeIssue(merged, raw, path);
  }
  const first = best.issues[0];
  return first === undefined ? null : describeIssue(first, raw, path);
}

/** Turn an unexpected error into a logged 500, or a 404 for a missing record. */
export function handleError(error: unknown, route: string): NextResponse<ApiError> {
  if (error instanceof NotFoundError) return fail(404, error.message);
  if (error instanceof SignInRequiredError) return fail(401, error.message);
  console.error(`[API ${route}] Unexpected error:`, error);
  return fail(500, "Something went wrong on our side. Try again in a moment.");
}
