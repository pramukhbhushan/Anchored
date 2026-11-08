import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { decideCardSchema, ingestSchema, setChoiceSchema } from "@/lib/api/schemas";
import { readBody } from "./http";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `readBody`'s 400 answers: one short sentence that names the field
// to fix, including when the body matches none of a union's shapes.

/** The 400 message `readBody` returns for `body` against `schema`. */
async function problem(schema: z.ZodType<unknown>, body: unknown): Promise<string> {
  const request = new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await readBody(request, schema);
  if (result.ok) throw new Error("expected the body to be refused");
  expect(result.response.status).toBe(400);
  return ((await result.response.json()) as { error: string }).error;
}

describe("readBody", () => {
  it("names the allowed values when a union's deciding field matches no shape", async () => {
    expect(await problem(decideCardSchema, { decision: "maybe" })).toBe("`decision` must be approve or skip.");
    expect(await problem(setChoiceSchema, { workflow: "calls", path: "later" })).toBe(
      "`path` must be turnon, buy, build or skip.",
    );
  });

  it("follows the union shape the body picked and names the field to fix there", async () => {
    expect(await problem(decideCardSchema, { decision: "approve", body: 5 })).toBe("`body` must be text.");
    expect(await problem(setChoiceSchema, { workflow: "calls", path: "turnon" })).toBe("`toolId` is missing.");
  });

  it("names a plain field with the wrong type or no value", async () => {
    expect(await problem(ingestSchema, { businessId: 7, payload: {} })).toBe("`businessId` must be text.");
    expect(await problem(ingestSchema, { businessId: "hvac" })).toBe("`payload` is missing.");
  });
});
