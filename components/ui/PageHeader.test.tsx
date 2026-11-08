import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";

// =============================================================================
// Module Overview
// =============================================================================
// Every page opens with one `h1`, its badge, a line of description and its
// actions; a section inside a page gets an `h2` that can name its region.

describe("PageHeader", () => {
  it("gives the page its one h1 with the badge, description and actions", () => {
    render(
      <PageHeader
        title="Approvals"
        badge={<span>3 waiting</span>}
        description="Drafts your agents wrote for your OK."
        actions={<button type="button">Try an example event</button>}
      />,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Approvals" })).toBeInTheDocument();
    expect(screen.getByText("3 waiting")).toBeInTheDocument();
    expect(screen.getByText("Drafts your agents wrote for your OK.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try an example event" })).toBeInTheDocument();
  });

  it("keeps the same content in its compact form", () => {
    render(<PageHeader compact title="Chat" description="Tell Anchored what changed." />);

    expect(screen.getByRole("heading", { level: 1, name: "Chat" })).toBeInTheDocument();
    expect(screen.getByText("Tell Anchored what changed.")).toBeInTheDocument();
  });
});

describe("SectionHeader", () => {
  it("names the section it heads through its id", () => {
    render(
      <section aria-labelledby="workflows-title">
        <SectionHeader id="workflows-title" title="Workflows" description="Pick a path for each." action={<a href="#all">See all</a>} />
      </section>,
    );

    expect(screen.getByRole("region", { name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByText("Pick a path for each.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toBeInTheDocument();
  });
});
