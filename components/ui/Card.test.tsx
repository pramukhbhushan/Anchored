import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "@/components/ui/Card";

// =============================================================================
// Module Overview
// =============================================================================
// `Card` as a reader meets it: a titled card is a heading at the level the
// page needs, with its description and action, and an untitled card is just
// its content.

describe("Card", () => {
  it("heads its content with a level 2 title, a description and an action", () => {
    render(
      <Card title="Your monthly bill" description="Everything in your stack." action={<button type="button">Export</button>}>
        <p>$129 a month</p>
      </Card>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Your monthly bill" })).toBeInTheDocument();
    expect(screen.getByText("Everything in your stack.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByText("$129 a month")).toBeInTheDocument();
  });

  it("uses a level 3 title when it sits under a section heading", () => {
    render(<Card title="Calls" level={3} />);

    expect(screen.getByRole("heading", { level: 3, name: "Calls" })).toBeInTheDocument();
  });

  it("renders as the landmark it is told to be", () => {
    render(<Card as="article" title="Rosa's Taqueria" />);

    expect(screen.getByRole("article")).toHaveTextContent("Rosa's Taqueria");
  });

  it("shows no heading without a title", () => {
    render(<Card>Just the content</Card>);

    expect(screen.getByText("Just the content")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
