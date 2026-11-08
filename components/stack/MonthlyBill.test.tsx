import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MonthlyBill as Bill } from "@/components/stack/bill";
import { MonthlyBill } from "@/components/stack/MonthlyBill";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's cost picture as an owner reads it: the monthly total, a bar
// whose text alternative carries every paid piece, and one group per kind of
// cost, each naming its pieces and what they do.

/** A landscaper paying for Anchored's plan and Jobber, with QuickBooks they already have. */
const BILL: Bill = {
  total: 129,
  plan: 29,
  onQuote: [],
  segments: [
    {
      key: "anchored",
      group: "build",
      name: "Anchored's agents",
      amount: 29,
      share: 0.22,
    },
    { key: "jobber", group: "buy", name: "Jobber", amount: 100, share: 0.78 },
  ],
  groups: [
    {
      id: "build",
      amount: 29,
      lines: [
        {
          key: "followup",
          name: "Follow-up",
          does: ["Follows up on quotes"],
          price: null,
        },
      ],
    },
    {
      id: "buy",
      amount: 100,
      lines: [
        {
          key: "jobber",
          name: "Jobber",
          does: ["Tracks quotes and follows up"],
          price: "$100",
        },
      ],
    },
    {
      id: "turnon",
      amount: 0,
      lines: [
        {
          key: "qbo",
          name: "QuickBooks Online",
          does: ["Keeps your books"],
          price: "Already paid",
        },
      ],
    },
    { id: "skip", amount: 0, lines: [] },
  ],
  pricesCheckedOn: "Nov 6 and 7, 2026",
};

/** Nothing chosen yet: no plan, no tools, and two workflows skipped. */
const NOTHING_YET: Bill = {
  total: 0,
  plan: 0,
  onQuote: [],
  segments: [],
  groups: [
    { id: "build", amount: 0, lines: [] },
    { id: "buy", amount: 0, lines: [] },
    { id: "turnon", amount: 0, lines: [] },
    {
      id: "skip",
      amount: 0,
      lines: [
        { key: "calls", name: "Calls", does: [], price: null },
        { key: "social", name: "Social", does: [], price: null },
      ],
    },
  ],
  pricesCheckedOn: null,
};

describe("MonthlyBill", () => {
  it("shows the monthly total", () => {
    render(<MonthlyBill bill={BILL} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Your monthly bill" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$129")).toBeInTheDocument();
    expect(screen.getByText("a month")).toBeInTheDocument();
  });

  it("names vendors that only quote beside the total", () => {
    render(<MonthlyBill bill={{ ...BILL, onQuote: ["ServiceTitan"] }} />);

    expect(screen.getByText(/ServiceTitan on quote/)).toBeInTheDocument();
  });

  it("describes the bar in text, with every paid piece and its price", () => {
    render(<MonthlyBill bill={BILL} />);

    const bar = screen.getByRole("img");
    expect(bar).toHaveAccessibleName(/\$129 a month/);
    expect(bar).toHaveAccessibleName(/Anchored's agents \$29/);
    expect(bar).toHaveAccessibleName(/Jobber \$100/);
  });

  it("shows one group per kind of cost, each named for who handles the work, with its amount", () => {
    render(<MonthlyBill bill={BILL} />);

    const groups = screen.getAllByRole("heading", { level: 3 });
    expect(groups).toHaveLength(4);
    expect(groups.map((heading) => heading.textContent)).toEqual([
      expect.stringMatching(/^Anchored drafts, you approve\s*\$29$/),
      expect.stringMatching(/^New tools\s*\$100$/),
      expect.stringMatching(/^Tools you already have\s*\$0$/),
      expect.stringMatching(/^Not handled yet\s*\$0$/),
    ]);
  });

  it("names each piece with its price and what it does", () => {
    render(<MonthlyBill bill={BILL} />);

    expect(screen.getByText("Follow-up")).toBeInTheDocument();
    expect(screen.getByText("Follows up on quotes")).toBeInTheDocument();
    expect(screen.getByText("QuickBooks Online")).toBeInTheDocument();
    expect(screen.getByText("Already paid")).toBeInTheDocument();
    expect(
      screen.getByText("Tracks quotes and follows up"),
    ).toBeInTheDocument();
  });

  it("keeps all four groups and draws no bar when nothing costs money", () => {
    render(<MonthlyBill bill={NOTHING_YET} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.getByText("Calls")).toBeInTheDocument();
    expect(screen.getByText("Social")).toBeInTheDocument();
  });

  it("dates the tool prices on the bill, and claims no date with no tool on it", () => {
    const { unmount } = render(<MonthlyBill bill={BILL} />);
    expect(
      screen.getByText(
        /Tool prices come from pages checked Nov 6 and 7, 2026\./,
      ),
    ).toBeInTheDocument();
    unmount();

    render(<MonthlyBill bill={NOTHING_YET} />);
    expect(screen.queryByText(/pages checked/)).not.toBeInTheDocument();
  });
});

it("lets an owner select a paid piece with the keyboard and see its work", async () => {
  render(<MonthlyBill bill={BILL} />);
  const jobber = screen.getByRole("button", { name: /Jobber \$100/ });
  jobber.focus();
  await userEvent.keyboard("{Enter}");
  expect(jobber).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Jobber covers");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Tracks quotes and follows up",
  );
  await userEvent.keyboard("{Enter}");
  expect(jobber).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
