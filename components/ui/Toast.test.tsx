import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast, type ToastLink } from "@/components/ui/Toast";

// =============================================================================
// Module Overview
// =============================================================================
// The toast as an owner sees it: a status line that appears when a component
// calls `useToast`, clears itself after a few seconds, stays longer when it
// carries a link, and holds while the pointer is on it. Time is faked, so these
// tests use `fireEvent`: user-event waits on real timeouts between steps.

const SEE_OUTBOX: ToastLink = { label: "See outbox", href: "#outbox" };

/** A page with two buttons that each raise a toast. */
function Page() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast("Skipped")}>
        Skip
      </button>
      <button type="button" onClick={() => toast("Approved", SEE_OUTBOX)}>
        Approve
      </button>
    </>
  );
}

function renderPage() {
  return render(
    <ToastProvider>
      <Page />
    </ToastProvider>,
  );
}

function press(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

function advance(ms: number): void {
  act(() => vi.advanceTimersByTime(ms));
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("Toast", () => {
  it("shows nothing until something happens", () => {
    renderPage();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the message in a status line, then clears it after a few seconds", () => {
    renderPage();

    press("Skip");
    expect(screen.getByRole("status")).toHaveTextContent("Skipped");

    advance(3000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers its link and stays up longer with one", () => {
    renderPage();

    press("Approve");
    expect(screen.getByRole("link", { name: "See outbox" })).toHaveAttribute("href", "#outbox");

    advance(3000);
    expect(screen.getByRole("status")).toHaveTextContent("Approved");

    advance(4000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("holds while the pointer rests on it, then clears after the pointer leaves", () => {
    renderPage();
    press("Approve");

    fireEvent.mouseEnter(screen.getByRole("status"));
    advance(20_000);
    expect(screen.getByRole("status")).toHaveTextContent("Approved");

    fireEvent.mouseLeave(screen.getByRole("status"));
    advance(3000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("holds while its link has keyboard focus", () => {
    renderPage();
    press("Approve");

    act(() => screen.getByRole("link", { name: "See outbox" }).focus());
    advance(20_000);

    expect(screen.getByRole("status")).toHaveTextContent("Approved");
  });

  it("clears as soon as its link is followed", () => {
    renderPage();
    press("Approve");

    fireEvent.click(screen.getByRole("link", { name: "See outbox" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("replaces the last message with the newest, on the newest's clock", () => {
    renderPage();

    press("Approve");
    advance(2000);
    press("Skip");

    expect(screen.getByRole("status")).toHaveTextContent("Skipped");
    expect(screen.getByRole("status")).not.toHaveTextContent("Approved");
    advance(2000);
    expect(screen.getByRole("status")).toHaveTextContent("Skipped");
  });

  it("does nothing outside a provider instead of failing", () => {
    render(<Page />);

    press("Skip");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
