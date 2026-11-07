import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteError } from "@/components/ui/RouteError";
import { router } from "@/test/next";

// =============================================================================
// Module Overview
// =============================================================================
// What an owner sees when a page under `/app` fails: an alert naming the page,
// a "Try again" that refetches before re-rendering, a way back to the list of
// businesses, and a sign-in link when the failure can mean a lapsed session.

const failure = Object.assign(new Error("feed read failed"), { digest: "4021337" });

beforeEach(() => {
  // The component logs the failure for the audit trail; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("RouteError", () => {
  it("alerts with the page's title and offers a way back to the businesses", () => {
    render(<RouteError error={failure} reset={vi.fn()} title="Couldn't load approvals" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load approvals");
    expect(screen.getByRole("heading", { level: 1, name: "Couldn't load approvals" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to your businesses" })).toHaveAttribute("href", "/app");
    expect(screen.queryByRole("link", { name: "Sign in again" })).not.toBeInTheDocument();
  });

  it("refetches the page and resets it when the owner tries again", async () => {
    const reset = vi.fn();
    render(<RouteError error={failure} reset={reset} title="Couldn't load approvals" />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("offers sign-in for errors that can mean a lapsed session, returning to the businesses", () => {
    render(<RouteError error={failure} reset={vi.fn()} title="Couldn't load this business" signIn />);

    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/login?next=%2Fapp");
  });

  it("shows the error reference the server logged, when there is one", () => {
    const { rerender } = render(<RouteError error={failure} reset={vi.fn()} title="Couldn't load approvals" />);
    expect(screen.getByText("Error reference 4021337")).toBeInTheDocument();

    rerender(<RouteError error={new Error("no digest")} reset={vi.fn()} title="Couldn't load approvals" />);
    expect(screen.queryByText(/Error reference/)).not.toBeInTheDocument();
  });
});
