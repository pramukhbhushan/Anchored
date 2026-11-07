import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/EmptyState";

// =============================================================================
// Module Overview
// =============================================================================
// An empty list says what will appear and offers the action that fills it.
// Its icon is decoration, so screen readers skip it.

describe("EmptyState", () => {
  it("names what is missing, says what to do and offers the action", () => {
    render(
      <EmptyState
        icon={<svg role="img" aria-label="Inbox icon" />}
        title="Nothing waits for you"
        actions={<a href="/app/b/rosa/workflows">Pick a path</a>}
      >
        Choose an agent for a workflow and its drafts land here.
      </EmptyState>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Nothing waits for you" })).toBeInTheDocument();
    expect(screen.getByText("Choose an agent for a workflow and its drafts land here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pick a path" })).toHaveAttribute("href", "/app/b/rosa/workflows");
    expect(screen.queryByRole("img", { name: "Inbox icon" })).not.toBeInTheDocument();
  });

  it("shows only the title when given nothing else", () => {
    render(<EmptyState title="No businesses yet" />);

    expect(screen.getByRole("heading", { name: "No businesses yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
