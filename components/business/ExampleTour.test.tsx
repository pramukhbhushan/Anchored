import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExampleTour } from "@/components/business/ExampleTour";

// =============================================================================
// Module Overview
// =============================================================================
// The example's four stops as a first visitor reads them: named, in sidebar
// order, each a link to that page of the example business.

describe("ExampleTour", () => {
  it("links the four stops in sidebar order", () => {
    render(<ExampleTour businessId="restaurant" />);

    const tour = screen.getByRole("navigation", { name: "Four stops through the example" });
    const links = within(tour).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/app/b/restaurant/workflows",
      "/app/b/restaurant/tools",
      "/app/b/restaurant/approvals",
      "/app/b/restaurant/stack",
    ]);
    expect(links[2]).toHaveAccessibleName(/Approve the drafts/);
  });
});
