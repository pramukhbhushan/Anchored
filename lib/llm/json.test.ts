import { describe, expect, it } from "vitest";
import { extractJson, strictJsonSchema } from "./json";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `extractJson` on the reply shapes models send when JSON is asked
// for in the prompt, and of `strictJsonSchema` on the nested schemas that
// OpenAI-style strict mode needs closed.

describe("extractJson", () => {
  it("parses a reply that is only JSON", () => {
    expect(extractJson('  {"trade": "bakery", "tasks": ["orders"]}\n')).toEqual({ trade: "bakery", tasks: ["orders"] });
  });

  it("parses the JSON inside a fenced block surrounded by prose", () => {
    const reply = 'Here is the profile:\n```json\n{"trade": "bakery"}\n```\nLet me know if you want changes.';
    expect(extractJson(reply)).toEqual({ trade: "bakery" });
  });

  it("parses a fenced block that has no language tag", () => {
    expect(extractJson('```\n{"trade": "bakery"}\n```')).toEqual({ trade: "bakery" });
  });

  it("parses the outermost object when prose wraps it without a fence", () => {
    const reply = 'Sure! {"trade": "bakery", "owner": {"name": "Rosa"}} Hope that helps.';
    expect(extractJson(reply)).toEqual({ trade: "bakery", owner: { name: "Rosa" } });
  });

  it("throws a `SyntaxError` when the reply holds no JSON", () => {
    expect(() => extractJson("I can't write that profile.")).toThrow(SyntaxError);
  });

  it("throws a `SyntaxError` when the JSON is cut off", () => {
    expect(() => extractJson('{"trade": "bakery", "tasks": ["ord')).toThrow(SyntaxError);
  });
});

describe("strictJsonSchema", () => {
  const profileSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      trade: { type: "string" },
      note: { type: "string" },
      reasons: {
        type: "array",
        items: { type: "object", properties: { workflow: { type: "string" }, why: { type: "string" } }, required: ["workflow"] },
      },
    },
    required: ["trade", "reasons"],
  };

  it("closes every object and requires all of its properties, nested ones included", () => {
    expect(strictJsonSchema(profileSchema)).toEqual({
      type: "object",
      properties: {
        trade: { type: "string" },
        note: { type: "string" },
        reasons: {
          type: "array",
          items: {
            type: "object",
            properties: { workflow: { type: "string" }, why: { type: "string" } },
            required: ["workflow", "why"],
            additionalProperties: false,
          },
        },
      },
      required: ["trade", "note", "reasons"],
      additionalProperties: false,
    });
  });

  it("returns a copy and leaves the input schema as it was", () => {
    const before = structuredClone(profileSchema);
    strictJsonSchema(profileSchema);
    expect(profileSchema).toEqual(before);
  });

  it("leaves schemas without object properties unchanged", () => {
    const tone = { type: "string", enum: ["warm", "plain"] };
    expect(strictJsonSchema(tone)).toEqual(tone);
  });
});
