import { describe, expect, it } from "vitest";
import { checkedSpan } from "@/lib/domain/catalog";

// =============================================================================
// Module Overview
// =============================================================================
// How the catalog says when its facts were checked: one phrase for the dates
// of exactly the tools on screen, never a fixed date.

describe("checkedSpan", () => {
  it("says one date once", () => {
    expect(checkedSpan(["Nov 7, 2026", "Nov 7, 2026"])).toBe("Nov 7, 2026");
  });

  it("joins days in one month", () => {
    expect(checkedSpan(["Nov 7, 2026", "Nov 6, 2026"])).toBe("Nov 6 and 7, 2026");
    expect(checkedSpan(["Nov 7, 2026", "Nov 3, 2026", "Nov 6, 2026"])).toBe("Nov 3, 6 and 7, 2026");
  });

  it("gives the first and last date across months", () => {
    expect(checkedSpan(["Nov 7, 2026", "Oct 30, 2026", "Nov 6, 2026"])).toBe("Oct 30, 2026 to Nov 7, 2026");
  });

  it("has nothing to say about no tools", () => {
    expect(checkedSpan([])).toBeNull();
  });
});
