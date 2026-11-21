import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { deferred } from "@/test/http";
import { BriefRunButton, type BriefRunResult } from "./BriefRunButton";

// =============================================================================
// Module Overview
// =============================================================================
// Brief refresh behavior: last successful content remains readable through
// failures and pending requests, and one business never adopts another's run.

const PREVIOUS = { text: "Two drafts wait for your approval.", generatedAt: "2026-11-08T15:00:00Z" };

describe("BriefRunButton", () => {
  it("explains an unavailable action without inventing an empty successful brief", () => {
    render(<BriefRunButton businessId="shop" brief={null} unavailableReason="Daily brief runs aren't ready yet." />);
    expect(screen.getByText("Your daily brief is not available yet.")).toBeInTheDocument();
    expect(screen.getByText("Daily brief runs aren't ready yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run now" })).not.toBeInTheDocument();
  });

  it("keeps the last brief while running and blocks duplicate requests", async () => {
    const user = userEvent.setup();
    const reply = deferred<BriefRunResult>();
    const run = vi.fn(() => reply.promise);
    render(<BriefRunButton businessId="shop" brief={PREVIOUS} run={run} />);
    await user.dblClick(screen.getByRole("button", { name: "Run now" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByText(PREVIOUS.text)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Updating..." })).toBeDisabled();
    reply.resolve({ text: "All drafts have been reviewed.", generatedAt: "2026-11-08T16:00:00Z" });
    expect(await screen.findByText("All drafts have been reviewed.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your brief is up to date.");
  });

  it("keeps the up-to-date notice when the refreshed page brings the new brief", async () => {
    const user = userEvent.setup();
    const fresh = { text: "All drafts have been reviewed.", generatedAt: "2026-11-08T16:00:00Z" };
    const { rerender } = render(<BriefRunButton businessId="shop" brief={PREVIOUS} run={async () => fresh} />);
    await user.click(screen.getByRole("button", { name: "Run now" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your brief is up to date.");
    rerender(<BriefRunButton businessId="shop" brief={fresh} run={async () => fresh} />);
    expect(screen.getByText(fresh.text)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your brief is up to date.");
  });

  it("shows a newer brief the page brings without a run", () => {
    const { rerender } = render(<BriefRunButton businessId="shop" brief={PREVIOUS} run={vi.fn()} />);
    rerender(<BriefRunButton businessId="shop" brief={{ text: "The scheduled brief ran.", generatedAt: "2026-11-09T12:00:00Z" }} run={vi.fn()} />);
    expect(screen.getByText("The scheduled brief ran.")).toBeInTheDocument();
  });

  it("keeps the last successful brief after failure and allows retry", async () => {
    const user = userEvent.setup();
    const run = vi.fn().mockRejectedValueOnce(new Error("Check your connection.")).mockResolvedValueOnce({ text: "One new draft waits.", generatedAt: "2026-11-08T16:00:00Z" });
    render(<BriefRunButton businessId="shop" brief={PREVIOUS} run={run} />);
    await user.click(screen.getByRole("button", { name: "Run now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The brief didn't update.");
    expect(screen.getByText(PREVIOUS.text)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run now" }));
    expect(await screen.findByText("One new draft waits.")).toBeInTheDocument();
  });

  it("doesn't replace another business's brief with a late result", async () => {
    const user = userEvent.setup();
    const reply = deferred<BriefRunResult>();
    const { rerender } = render(<BriefRunButton businessId="first" brief={PREVIOUS} run={() => reply.promise} />);
    await user.click(screen.getByRole("button", { name: "Run now" }));
    rerender(<BriefRunButton businessId="second" brief={null} run={vi.fn()} />);
    reply.resolve({ text: "First shop is all caught up.", generatedAt: "2026-11-08T16:00:00Z" });
    await waitFor(() => expect(screen.getByText("No daily brief has been generated yet.")).toBeInTheDocument());
    expect(screen.queryByText("First shop is all caught up.")).not.toBeInTheDocument();
  });
});
