import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { countPaths, PlanSummary } from "@/components/business/PlanSummary";
import { TOOLS } from "@/lib/domain/catalog";

// =============================================================================
// Module Overview
// =============================================================================
// The plan at a glance as an owner reads it: how many workflows sit on each
// path, said in words, and what it costs a month with a way to the Stack page.

describe("PlanSummary", () => {
  it("counts each path in words and leaves out paths with none", () => {
    const counts = countPaths([{ path: "build", skills: [] }, { path: "build", skills: [] }, { path: "skip" }]);
    render(<PlanSummary counts={counts} cost={{ tools: 0, plan: 29, total: 29, onQuote: [] }} stackHref="/app/b/x/stack" />);

    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["2 built by Anchored's agents", "1 skipped for now"]);
  });

  it("says the monthly cost, what waits on a quote, and links to the stack", () => {
    const counts = countPaths([{ path: "buy", toolId: "jobber" }]);
    const quoted = TOOLS.filter((tool) => tool.monthly === null).slice(0, 1);
    render(
      <PlanSummary
        counts={counts}
        cost={{ tools: 187, plan: 0, total: 187, onQuote: quoted }}
        stackHref="/app/b/x/stack"
      />,
    );

    expect(screen.getByText("$187")).toBeInTheDocument();
    expect(screen.getByText(/a month, plus 1 on quote/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See your stack" })).toHaveAttribute("href", "/app/b/x/stack");
  });
});
