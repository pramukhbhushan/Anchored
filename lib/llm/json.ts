// =============================================================================
// Module Overview
// =============================================================================
// Helpers for providers without native structured output: pull one JSON value
// out of a model's reply, and tighten a JSON Schema for providers whose strict
// mode needs every object closed and every property required.

/** Parse the JSON value in `text`: the whole reply, a fenced block, or the outermost object. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next, narrower candidate.
    }
  }
  throw new SyntaxError("The reply has no JSON object in it.");
}

/** Return a copy of `schema` with every object closed and all its properties required. */
export function strictJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(strictJsonSchema);
  if (schema === null || typeof schema !== "object") return schema;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) copy[key] = strictJsonSchema(value);
  if (copy.type === "object" && copy.properties && typeof copy.properties === "object") {
    copy.additionalProperties = false;
    copy.required = Object.keys(copy.properties);
  }
  // `$schema` is metadata that some strict validators reject.
  delete copy.$schema;
  return copy;
}
