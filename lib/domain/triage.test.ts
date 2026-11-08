import { describe, expect, it } from "vitest";
import type { SkillId } from "@/lib/domain/types";
import { classifyEmail, routeEmail } from "./triage";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of Inbox Triage's sorting: each kind of forwarded email by its own
// words, the narrow kinds first, and the owner as the receiver whenever the
// business didn't choose the skill for that kind.

const mail = (subject: string, text = "", from = "someone@example.com") => ({ from, subject, text });

describe("classifyEmail", () => {
  it("reads each kind from the subject, sender and text", () => {
    expect(classifyEmail(mail("Can you quote a new water heater?"))).toBe("customer");
    expect(classifyEmail(mail("Invoice 1042 is past due"))).toBe("billing");
    expect(classifyEmail(mail("Updated price list", "", "orders@sysco.com"))).toBe("supplier");
    expect(classifyEmail(mail("You have a new review on Google"))).toBe("review");
    expect(classifyEmail(mail("Lunch next week?"))).toBe("unknown");
  });

  it("puts a supplier's invoice with suppliers and a review that mentions a booking with reviews", () => {
    expect(classifyEmail(mail("Invoice from your distributor"))).toBe("supplier");
    expect(classifyEmail(mail("Dana left a review", "Great appointment, 5-star service"))).toBe("review");
  });
});

describe("routeEmail", () => {
  it("sends each kind to its skill when chosen, and to the owner when not", () => {
    const chosen = new Set<SkillId>(["inquiry", "nudger"]);
    expect(routeEmail("customer", chosen)).toEqual({ kind: "customer", skill: "inquiry" });
    expect(routeEmail("billing", chosen)).toEqual({ kind: "billing", skill: "nudger" });
    expect(routeEmail("supplier", chosen)).toEqual({ kind: "supplier", skill: null });
    expect(routeEmail("unknown", chosen)).toEqual({ kind: "unknown", skill: null });
  });
});
