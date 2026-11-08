import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ApprovePlanButton } from "@/components/workflows/ApprovePlanButton";
import { ToastProvider } from "@/components/ui/Toast";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's yes to the whole plan: the button saves it, says the plan is
// live, refreshes the page, and can't be pressed twice while it saves.

const APPROVAL = { planApproval: { approvedAt: "2026-11-07T15:30:00.000Z", choices: {} } };

function renderButton(label = "Approve this plan") {
  return render(
    <ToastProvider>
      <ApprovePlanButton businessId="b_own" label={label} />
    </ToastProvider>,
  );
}

describe("ApprovePlanButton", () => {
  it("saves the approval, says the plan is live and refreshes the page", async () => {
    const fetchSpy = stubFetch(() => json(APPROVAL));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Approve this plan" }));

    expect(await screen.findByText(/plan is live/i)).toHaveRole("status");
    expect(sentJson(fetchSpy, 0)).toEqual({ method: "PUT", url: "/api/businesses/b_own/plan", body: { approved: true } });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("can't be pressed again while it saves", async () => {
    const answer = deferred<Response>();
    const fetchSpy = stubFetch(() => answer.promise);
    renderButton("Approve changes");

    const button = screen.getByRole("button", { name: "Approve changes" });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    answer.resolve(json(APPROVAL));
  });

  it("shows the route's reason when the save fails", async () => {
    stubFetch(() => json({ error: "Business not found. It may have been reset." }, 404));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Approve this plan" }));

    expect(await screen.findByText("Business not found. It may have been reset.")).toHaveRole("status");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
