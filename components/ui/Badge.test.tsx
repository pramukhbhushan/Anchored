import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/Badge";

// =============================================================================
// Module Overview
// =============================================================================
// `Badge` carries its words whatever its tone; the tone is styling only.

describe("Badge", () => {
  it("shows its label in every tone", () => {
    render(
      <>
        <Badge>Phone</Badge>
        <Badge tone="new">New for you</Badge>
        <Badge tone="count">3</Badge>
      </>,
    );

    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("New for you")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
