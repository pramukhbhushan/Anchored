import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { profileFromFacts } from "@/lib/domain/engine";
import type { BusinessProfile } from "@/lib/domain/types";
import { ProfileDetails } from "./ProfileDetails";

// =============================================================================
// Module Overview
// =============================================================================
// What the owner reads in "What agents work from": each detail with its source,
// a disagreement as a question, what's still needed with the way to add it,
// and the saved versions.

const shop: BusinessProfile = {
  ...profileFromFacts({ name: "Apex Heating", trade: "HVAC contractor", tradeKey: "home", reach: ["Phone calls"], tools: [], signals: ["quotes"] }),
  id: "b_apex",
  details: { hours: "Mon to Fri 8 to 8", minimumCharge: 89 },
  evidence: {
    hours: { sourceType: "owner", quote: "we close at 8", confidence: "high", ownerConfirmed: true, conflicts: [{ value: "Mon to Fri 8 to 6", sourceType: "listing", quote: "8 to 6" }] },
    minimumCharge: { sourceType: "owner", quote: "minimum is $89", confidence: "high", ownerConfirmed: true },
  },
};

describe("ProfileDetails", () => {
  it("shows each detail with its source and any disagreement", () => {
    render(<ProfileDetails business={shop} agents={["frontdesk", "followup"]} versions={[]} canChat />);

    const hours = screen.getByText("Hours").closest("div");
    if (!hours) throw new Error("hours row missing");
    expect(within(hours).getByText("Mon to Fri 8 to 8")).toBeInTheDocument();
    expect(within(hours).getByText("From you")).toBeInTheDocument();
    expect(within(hours).getByText("Your Google listing says Mon to Fri 8 to 6. You said Mon to Fri 8 to 8. Which is right?")).toBeInTheDocument();
    expect(screen.getByText("$89")).toBeInTheDocument();
  });

  it("lists what the agents still need and links to Chat to add it", () => {
    render(<ProfileDetails business={shop} agents={["frontdesk", "followup"]} versions={[]} canChat />);

    const needed = screen.getByText("Still needed").closest("div");
    if (!needed) throw new Error("still needed row missing");
    expect(within(needed).getByText(/Your words for customers and work/)).toBeInTheDocument();
    expect(within(needed).getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/app/b/b_apex/chat");
  });

  it("lists the saved versions, newest first", () => {
    render(
      <ProfileDetails
        business={shop}
        agents={[]}
        versions={[
          { version: 2, changedBy: "chat", savedAt: "2026-11-07T20:12:00Z", snapshot: shop },
          { version: 1, changedBy: "onboarding", savedAt: "2026-11-07T19:00:00Z", snapshot: shop },
        ]}
        canChat
      />,
    );

    expect(screen.getByText("History, 2 versions")).toBeInTheDocument();
    expect(screen.getByText("Version 2: Chat, Nov 7, 3:12 PM")).toBeInTheDocument();
    expect(screen.getByText("Version 1: Onboarding, Nov 7, 2:00 PM")).toBeInTheDocument();
  });
});
