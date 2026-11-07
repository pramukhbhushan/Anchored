import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FlowLane } from "@/components/stack/flow";
import { WorkFlow } from "@/components/stack/WorkFlow";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's flow diagram as an owner reads it: one row per kind of
// work, from what starts it to what they get. Work an agent drafts waits for
// the owner's OK and lands in Approvals; work a tool does stays outside it.

const FOLLOWUP: FlowLane = {
  handler: { kind: "agent", id: "followup", name: "Follow-up", note: "In your $29 plan" },
  routes: [
    {
      key: "closer",
      trigger: "A customer goes quiet after a quote",
      handoff: "Up to three follow-ups",
      result: "A signed quote",
      stake: "$2,400 a month in open quotes",
    },
    { key: "reviewer", trigger: "A job is finished and paid", handoff: "One review request", result: "A new Google review", stake: null },
  ],
};

const FRONT_DESK: FlowLane = {
  handler: { kind: "agent", id: "frontdesk", name: "Front desk", note: "In your $29 plan" },
  routes: [{ key: "callback", trigger: "A customer calls and nobody picks up", handoff: "A text back", result: "A booked job", stake: null }],
};

const JOBBER: FlowLane = {
  handler: { kind: "tool", id: "jobber", name: "Jobber", path: "buy", note: "New, $100 a month" },
  routes: [{ key: "jobber:quotes", trigger: "You send a quote", handoff: "Jobber's own follow-up rules", result: "A tracked quote", stake: null }],
};

const LINKS = { approvalsHref: "/app/b/greenfield/approvals", workflowsHref: "/app/b/greenfield/workflows" };

function agentWork(): HTMLElement {
  return screen.getByRole("list", { name: "Work your agents draft for your OK" });
}

function toolWork(): HTMLElement {
  return screen.getByRole("list", { name: "Work your tools handle" });
}

describe("WorkFlow", () => {
  it("shows one row per kind of work an agent drafts, each waiting for the owner's OK", () => {
    render(<WorkFlow lanes={[FOLLOWUP, FRONT_DESK]} waiting={0} {...LINKS} />);

    const agents = agentWork();
    expect(within(agents).getByText("Follow-up agent")).toBeInTheDocument();
    expect(within(agents).getByText("Front desk agent")).toBeInTheDocument();
    expect(within(agents).getAllByText("Waits for your OK")).toHaveLength(3);
    for (const route of [...FOLLOWUP.routes, ...FRONT_DESK.routes]) {
      expect(within(agents).getByText(route.trigger)).toBeInTheDocument();
      expect(within(agents).getByText(route.handoff, { exact: false })).toBeInTheDocument();
      expect(within(agents).getByText(route.result, { exact: false })).toBeInTheDocument();
    }
  });

  it("shows what rides on the work when the research gives a figure", () => {
    render(<WorkFlow lanes={[FOLLOWUP]} waiting={0} {...LINKS} />);

    expect(within(agentWork()).getByText("$2,400 a month in open quotes")).toBeInTheDocument();
  });

  it("sends every draft to Approvals and says how many wait", () => {
    const { rerender } = render(<WorkFlow lanes={[FOLLOWUP]} waiting={2} {...LINKS} />);
    expect(screen.getByRole("link", { name: "Approvals" })).toHaveAttribute("href", LINKS.approvalsHref);
    expect(screen.getByText(/2 wait\b/)).toBeInTheDocument();

    rerender(<WorkFlow lanes={[FOLLOWUP]} waiting={1} {...LINKS} />);
    expect(screen.getByText(/1 waits\b/)).toBeInTheDocument();

    rerender(<WorkFlow lanes={[FOLLOWUP]} waiting={0} {...LINKS} />);
    expect(screen.getByText(/Nothing waits/)).toBeInTheDocument();
  });

  it("keeps tool work apart, outside the owner's approvals", () => {
    render(<WorkFlow lanes={[FOLLOWUP, JOBBER]} waiting={0} {...LINKS} />);

    const tools = toolWork();
    expect(within(tools).getByText("Jobber")).toBeInTheDocument();
    expect(within(tools).getByText("New, $100 a month")).toBeInTheDocument();
    expect(within(tools).getByText("You send a quote")).toBeInTheDocument();
    expect(within(tools).queryByText("Waits for your OK")).not.toBeInTheDocument();
    expect(within(agentWork()).queryByText("Jobber")).not.toBeInTheDocument();
  });

  it("has no Approvals step when only tools do the work", () => {
    render(<WorkFlow lanes={[JOBBER]} waiting={0} {...LINKS} />);

    expect(toolWork()).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Work your agents draft for your OK" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Approvals" })).not.toBeInTheDocument();
  });

  it("offers a way to pick paths when nothing runs yet", () => {
    render(<WorkFlow lanes={[]} waiting={0} {...LINKS} />);

    expect(screen.getByRole("heading", { name: "Nothing runs yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change paths" })).toHaveAttribute("href", LINKS.workflowsHref);
  });
});
