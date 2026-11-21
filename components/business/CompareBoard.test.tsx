import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CompareBoard, type CompareItem } from "@/components/business/CompareBoard";
import type { Check, CheckKey, Rating, Tool, WorkflowId } from "@/lib/domain/types";
import { json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The tools page's rated list as an owner uses it: tools for their kind of
// business first, the rest behind a toggle, a Choose or Use button for the
// next workflow a tool could run, and up to three tools picked into a tray that
// opens a side-by-side table.

const MET: Check = ["met", "page", "Stated on the vendor page"];

function rating(total: number): Rating {
  const keys: readonly CheckKey[] = ["connects", "price", "charge", "data", "start", "langs", "proven"];
  return { total, checks: Object.fromEntries(keys.map((key) => [key, MET])) as Record<CheckKey, Check>, met: 7, unknown: 0 };
}

function item(id: string, name: string, workflows: readonly WorkflowId[], extra: Partial<CompareItem> = {}): CompareItem {
  const tool: Tool = {
    id,
    name,
    maker: name,
    workflows,
    for: ["home"],
    price: `${name} price`,
    monthly: 100,
    checks: { price: MET, charge: MET, data: MET },
    ai: null,
    source: { url: null, label: "Vendor page" },
    checkedOn: "Nov 6, 2026",
  };
  return { tool, name, rating: rating(80), owned: false, chosenFor: [], forThisBusiness: true, workflows, ...extra };
}

const JOBBER = item("jobber", "Jobber", ["quotes", "leads"]);
const QUICKBOOKS = item("qbo", "QuickBooks Online", ["books"], { owned: true });
const HOUSECALL = item("housecall", "Housecall Pro", ["quotes"], { chosenFor: ["quotes"] });
const TOAST_POS = item("toastpos", "Toast POS", ["books"], { forThisBusiness: false });
const ITEMS: readonly CompareItem[] = [JOBBER, QUICKBOOKS, HOUSECALL, TOAST_POS];

function shownTools(): string[] {
  return screen.queryAllByRole("article").map((card) => within(card).getByRole("heading").textContent ?? "");
}

function renderBoard(filter: WorkflowId | "all" = "all") {
  return render(<CompareBoard businessId="greenfield" items={ITEMS} filter={filter} />);
}

describe("CompareBoard", () => {
  it("lists the tools built for the owner's kind of business, each with its score and price", () => {
    renderBoard();

    expect(shownTools()).toEqual(["Jobber", "QuickBooks Online", "Housecall Pro"]);
    const jobber = screen.getAllByRole("article")[0];
    if (jobber === undefined) throw new Error("No tool cards");
    expect(jobber).toHaveTextContent("80");
    expect(jobber).toHaveTextContent("$100/mo");
  });

  it("shows tools built for other businesses when the owner asks", async () => {
    renderBoard();

    await userEvent.click(screen.getByRole("checkbox", { name: /built for other businesses \(1\)/ }));

    expect(shownTools()).toContain("Toast POS");
  });

  it("shows only the tools that cover the chosen workflow", () => {
    renderBoard("books");

    expect(shownTools()).toEqual(["QuickBooks Online"]);
  });

  it("says so when no tool for this business covers the workflow", () => {
    renderBoard("social");

    expect(shownTools()).toEqual([]);
    expect(screen.getByText(/No tool built for your kind of business/)).toBeInTheDocument();
  });

  it("buys a tool for the first workflow it doesn't run yet", async () => {
    const fetchSpy = stubFetch(() => json({ choice: { path: "buy", toolId: "jobber" } }));
    renderBoard();

    await userEvent.click(screen.getByRole("button", { name: "Choose Jobber for quotes and estimates" }));

    expect(sentJson(fetchSpy, 0)).toEqual({
      method: "PUT",
      url: "/api/businesses/greenfield/choices",
      body: { workflow: "quotes", path: "buy", toolId: "jobber" },
    });
  });

  it("chooses a tool for the filtered workflow", async () => {
    const fetchSpy = stubFetch(() => json({ choice: { path: "buy", toolId: "jobber" } }));
    renderBoard("leads");

    await userEvent.click(screen.getByRole("button", { name: "Choose Jobber for lead follow-up" }));

    expect(sentJson(fetchSpy, 0).body).toEqual({ workflow: "leads", path: "buy", toolId: "jobber" });
  });

  it("puts a tool the owner already pays for to use", async () => {
    const fetchSpy = stubFetch(() => json({ choice: { path: "turnon", toolId: "qbo" } }));
    renderBoard();

    await userEvent.click(screen.getByRole("button", { name: "Use QuickBooks Online for bookkeeping and invoicing" }));

    expect(sentJson(fetchSpy, 0).body).toEqual({ workflow: "books", path: "turnon", toolId: "qbo" });
  });

  it("says where a tool already runs and offers nothing more to choose", () => {
    renderBoard();

    const housecall = screen.getAllByRole("article")[2];
    if (housecall === undefined) throw new Error("No Housecall Pro card");
    expect(housecall).toHaveTextContent(/In your stack for quotes and estimates/);
    expect(within(housecall).queryByRole("button", { name: /^(Choose|Use)/ })).not.toBeInTheDocument();
  });

  it("collects tools to compare and opens them side by side", async () => {
    renderBoard();

    await userEvent.click(screen.getByRole("button", { name: "Compare Jobber" }));
    expect(screen.getByRole("button", { name: "Compare Jobber" })).toHaveAttribute("aria-pressed", "true");
    const tray = screen.getByRole("region", { name: "Tools to compare" });
    expect(tray).toHaveTextContent("Jobber");
    expect(within(tray).getByRole("button", { name: "Compare side by side" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Compare QuickBooks Online" }));
    await userEvent.click(within(tray).getByRole("button", { name: "Compare side by side" }));

    const dialog = screen.getByRole("dialog", { name: "Side by side" });
    const headers = within(dialog).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Check", "Jobber", "QuickBooks Online"]);
    expect(within(dialog).getByRole("rowheader", { name: "Price" })).toBeInTheDocument();
    expect(within(dialog).getByRole("rowheader", { name: "You stay in charge" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close comparison" }));
    expect(screen.queryByRole("dialog", { name: "Side by side" })).not.toBeInTheDocument();
  });

  it("drops the tool picked first when a fourth is picked", async () => {
    renderBoard();
    await userEvent.click(screen.getByRole("checkbox", { name: /built for other businesses/ }));

    for (const name of ["Jobber", "QuickBooks Online", "Housecall Pro", "Toast POS"]) {
      await userEvent.click(screen.getByRole("button", { name: `Compare ${name}` }));
    }

    expect(screen.getByRole("button", { name: "Compare Jobber" })).toHaveAttribute("aria-pressed", "false");
    const tray = screen.getByRole("region", { name: "Tools to compare" });
    expect(tray).not.toHaveTextContent("Jobber");
    expect(tray).toHaveTextContent(/QuickBooks Online.*Housecall Pro.*Toast POS/);
  });

  it("unpicks a tool pressed again, and Clear empties the tray", async () => {
    renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Compare Jobber" }));
    await userEvent.click(screen.getByRole("button", { name: "Compare Housecall Pro" }));

    await userEvent.click(screen.getByRole("button", { name: "Compare Jobber" }));
    expect(screen.getByRole("region", { name: "Tools to compare" })).not.toHaveTextContent("Jobber");

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Tools to compare" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare Housecall Pro" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps a compared tool in the tray when the filter hides its card", async () => {
    const { rerender } = renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Compare Jobber" }));

    rerender(<CompareBoard businessId="greenfield" items={ITEMS} filter="books" />);

    expect(shownTools()).not.toContain("Jobber");
    expect(screen.getByRole("region", { name: "Tools to compare" })).toHaveTextContent("Jobber");
  });
});


it("keeps comparison open while switching between costs and evidence", async () => {
  renderBoard();
  await userEvent.click(screen.getByRole("button", { name: "Compare Jobber" }));
  await userEvent.click(screen.getByRole("button", { name: "Compare QuickBooks Online" }));
  await userEvent.click(screen.getByRole("button", { name: "Compare side by side" }));
  const dialog = screen.getByRole("dialog", { name: "Side by side" });
  await userEvent.click(within(dialog).getByRole("tab", { name: "Costs" }));
  expect(within(dialog).getByRole("tabpanel")).toHaveTextContent("Jobber price");
  expect(within(dialog).getByRole("tabpanel")).toHaveTextContent("You already have this tool");
  await userEvent.click(within(dialog).getByRole("tab", { name: "Fit and evidence" }));
  expect(within(dialog).getByRole("table")).toBeInTheDocument();
});
