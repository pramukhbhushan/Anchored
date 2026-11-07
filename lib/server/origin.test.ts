import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./origin";

// =============================================================================
// Module Overview
// =============================================================================
// Which `Origin` headers `isAllowedOrigin` lets through for a request to `HOST`.

const HOST = "anchored.example.com";

describe("isAllowedOrigin", () => {
  it("allows a request from the same host", () => {
    expect(isAllowedOrigin(`https://${HOST}`, HOST)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("allows a request with no `Origin`, such as one from curl", () => {
    expect(isAllowedOrigin(null, HOST)).toBe(true);
  });

  it("refuses a foreign origin", () => {
    expect(isAllowedOrigin("https://evil.example", HOST)).toBe(false);
    expect(isAllowedOrigin(`https://${HOST}.evil.example`, HOST)).toBe(false);
    expect(isAllowedOrigin("http://localhost:4000", "localhost:3000")).toBe(false);
  });

  it("refuses an opaque or malformed origin", () => {
    expect(isAllowedOrigin("null", HOST)).toBe(false);
    expect(isAllowedOrigin("not a url", HOST)).toBe(false);
  });
});
