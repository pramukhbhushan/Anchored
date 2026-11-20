import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { deferred } from "@/test/http";
import { AcknowledgmentRule, type AcknowledgmentRuleState } from "./AcknowledgmentRule";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's explicit acknowledgment approval: visible template, saved
// versus attempted state, duplicate protection and business-switch isolation.

const OFF = { enabled: false };

describe("AcknowledgmentRule", () => {
  it("shows the exact acknowledgment before asking for approval", () => {
    render(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={OFF} save={vi.fn()} />);
    expect(screen.getByText("Thanks, Greenfield Lawn got your message and will reply soon.")).toBeInTheDocument();
    expect(screen.getByText(/never goes to a customer who sent \/stop/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText("Right now: Off")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("adopts the returned state only after an explicit save and blocks duplicate saves", async () => {
    const reply = deferred<AcknowledgmentRuleState>();
    const save = vi.fn(() => reply.promise);
    const user = userEvent.setup();
    render(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={OFF} save={save} />);
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Right now: Off")).toBeInTheDocument();
    await user.dblClick(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    reply.resolve({ enabled: true, approvedAt: "2026-11-08T15:00:00Z" });
    expect(await screen.findByText("Right now: On")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved. The acknowledgment rule is on.");
  });

  it("keeps the saved notice when the refreshed page passes back the state just saved", async () => {
    const saved = { enabled: true, approvedAt: "2026-11-08T15:00:00Z" };
    const user = userEvent.setup();
    const { rerender } = render(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={OFF} save={vi.fn().mockResolvedValue(saved)} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved. The acknowledgment rule is on.")).toBeInTheDocument();
    rerender(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={{ ...saved }} save={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved. The acknowledgment rule is on.");
    expect(screen.getByText("Right now: On")).toBeInTheDocument();
  });

  it("shows a state saved somewhere else", () => {
    const { rerender } = render(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={OFF} save={vi.fn()} />);
    rerender(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={{ enabled: true, approvedAt: "2026-11-08T15:00:00Z" }} save={vi.fn()} />);
    expect(screen.getByText("Right now: On")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("keeps the saved state and attempted choice on failure, then allows retry", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValueOnce(new Error("Check your connection.")).mockResolvedValueOnce({ enabled: true });
    render(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={OFF} save={save} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your change wasn't saved.");
    expect(screen.getByText("Right now: Off")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Right now: On")).toBeInTheDocument();
  });

  it("can save the rule as off", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue({ enabled: false });
    render(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={{ enabled: true }} save={save} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(false));
    expect(await screen.findByText("Right now: Off")).toBeInTheDocument();
  });

  it("distinguishes unknown state and read-only state", () => {
    const { rerender } = render(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={null} unavailableReason="Rule controls aren't ready yet." />);
    expect(screen.getByText("Saved rule state isn't available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    rerender(<AcknowledgmentRule businessId="shop" businessName="Greenfield Lawn" state={OFF} unavailableReason="You can view this rule only." />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("You can view this rule only.")).toBeInTheDocument();
  });

  it("ignores an old save after switching businesses", async () => {
    const reply = deferred<AcknowledgmentRuleState>();
    const user = userEvent.setup();
    const { rerender } = render(<AcknowledgmentRule businessId="first" businessName="First shop" state={OFF} save={() => reply.promise} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    rerender(<AcknowledgmentRule businessId="second" businessName="Second shop" state={OFF} save={vi.fn()} />);
    reply.resolve({ enabled: true });
    await waitFor(() => expect(screen.getByText("Right now: Off")).toBeInTheDocument());
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText("Thanks, Second shop got your message and will reply soon.")).toBeInTheDocument();
  });
});
