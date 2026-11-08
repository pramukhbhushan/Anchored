import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrewPanel } from "@/components/business/CrewPanel";
import { ToastProvider } from "@/components/ui/Toast";
import { withCrewDecisions } from "@/lib/domain/crew";
import { profileFromAnswers } from "@/lib/domain/engine";

// =============================================================================
// Module Overview
// =============================================================================
// Crew screen tests cover what an owner sees: five agents, the reason and
// source behind a choice, readiness, and a one-tap control for an off agent.

const BUSINESS = withCrewDecisions(profileFromAnswers({
  name: "Rise and Crumb, Laurel",
  kind: "Bakery",
  what: "Bread and cakes for local families",
  week: "Writing social posts",
  voice: "Thanks for stopping by.",
  reach: ["Walk-ins"],
  tools: [],
  signals: [],
  languages: ["English"],
}));

describe("CrewPanel", () => {
  it("shows every agent with its choice and readiness", () => {
    render(
      <ToastProvider>
        <CrewPanel business={BUSINESS} choices={{}} />
      </ToastProvider>,
    );

    expect(screen.getByRole("heading", { name: "Your crew" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Front Desk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow-up" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bookkeeping and Invoicing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Content and Social" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Internal Communications" })).toBeInTheDocument();
    expect(screen.getAllByText(/required details ready/)).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Turn on Front Desk" })).toBeInTheDocument();
    expect(screen.getByText('"Walk-ins"')).toBeInTheDocument();
  });
});
