import { describe, expect, it } from "vitest";
import { canHandoff, handoffConversation } from "@/lib/domain/conversation";

// =============================================================================
// Module Overview
// =============================================================================
// Conversation ownership tests cover the allowed Front Desk, Follow-up and
// Bookkeeping transitions and reject work that tries to leave a closed thread.

describe("conversation handoffs", () => {
  it("allows the documented agent transitions", () => {
    expect(canHandoff("frontdesk", "followup")).toBe(true);
    expect(canHandoff("frontdesk", "books")).toBe(true);
    expect(canHandoff("followup", "frontdesk")).toBe(true);
    expect(canHandoff("books", "closed")).toBe(true);
  });

  it("rejects a transition out of a closed conversation", () => {
    expect(handoffConversation("closed", "followup")).toEqual({
      ok: false,
      reason: "A closed conversation cannot move to followup.",
    });
  });
});
