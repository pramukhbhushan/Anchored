import { describe, expect, it } from "vitest";
import { acknowledgmentKey, acknowledgmentText, defaultRuleState, ruleEnabled, startNoticeText, stopNoticeText } from "./rules";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the standing rules: every rule starts off, the acknowledgment
// is the fixed text the owner approves, one key covers a whole window, and the
// protocol notices name the business.

describe("standing rules", () => {
  it("start off, and count as on only when saved on", () => {
    expect(defaultRuleState("acknowledge")).toMatchObject({ enabled: false, approvedAt: null });
    expect(ruleEnabled([], "acknowledge")).toBe(false);
    expect(ruleEnabled([{ rule: "acknowledge", enabled: false, approvedAt: "2026-11-08T10:00:00.000Z", changedAt: "2026-11-08T11:00:00.000Z" }], "acknowledge")).toBe(false);
    expect(ruleEnabled([{ rule: "acknowledge", enabled: true, approvedAt: "2026-11-08T10:00:00.000Z", changedAt: "2026-11-08T10:00:00.000Z" }], "acknowledge")).toBe(true);
  });
});

describe("acknowledgment", () => {
  it("is the fixed text from the design", () => {
    expect(acknowledgmentText("Linden Street Kitchen")).toBe("Thanks, Linden Street Kitchen got your message and will reply soon.");
  });

  it("shares one key within a 12-hour window and changes after it", () => {
    const first = acknowledgmentKey("c1", new Date("2026-11-08T13:05:00.000Z"));
    expect(acknowledgmentKey("c1", new Date("2026-11-08T23:59:00.000Z"))).toBe(first);
    expect(acknowledgmentKey("c1", new Date("2026-11-09T00:00:00.000Z"))).not.toBe(first);
    expect(acknowledgmentKey("c2", new Date("2026-11-08T13:05:00.000Z"))).not.toBe(first);
  });
});

describe("protocol notices", () => {
  it("name the business the customer is talking to", () => {
    expect(startNoticeText("Bowie HVAC")).toContain("Bowie HVAC");
    expect(stopNoticeText("Bowie HVAC")).toContain("Bowie HVAC");
  });
});
