import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChooseButton } from "@/components/business/ChooseButton";
import { ToastProvider } from "@/components/ui/Toast";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The button behind every path choice: it saves the choice, says what changed
// in a toast, refreshes the page, and can't be pressed twice while it saves.

const BUY_JOBBER: SetChoiceRequest = { workflow: "quotes", path: "buy", toolId: "jobber" };

function renderButton(request: SetChoiceRequest = BUY_JOBBER, extra: { pressed?: boolean; label?: string } = {}) {
  return render(
    <ToastProvider>
      <ChooseButton businessId="greenfield" request={request} className="btn" {...extra}>
        Choose
      </ChooseButton>
    </ToastProvider>,
  );
}

describe("ChooseButton", () => {
  it("saves the choice, says so and refreshes the page", async () => {
    const fetchSpy = stubFetch(() => json({ choice: { path: "buy", toolId: "jobber" } }));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Choose" }));

    expect(await screen.findByText(/Quotes and estimates/)).toHaveRole("status");
    expect(sentJson(fetchSpy, 0)).toEqual({ method: "PUT", url: "/api/businesses/greenfield/choices", body: BUY_JOBBER });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("says a skipped workflow is skipped", async () => {
    stubFetch(() => json({ choice: { path: "skip" } }));
    renderButton({ workflow: "calls", path: "skip" });

    await userEvent.click(screen.getByRole("button", { name: "Choose" }));

    expect(await screen.findByText(/Answer and return calls/)).toHaveTextContent(/skipped/i);
  });

  it("can't be pressed again while it saves", async () => {
    const answer = deferred<Response>();
    const fetchSpy = stubFetch(() => answer.promise);
    renderButton();

    const button = screen.getByRole("button", { name: "Choose" });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    answer.resolve(json({ choice: { path: "buy", toolId: "jobber" } }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("shows the route's reason when the save fails, and leaves the page as it was", async () => {
    stubFetch(() => json({ error: "Jobber doesn't cover that workflow." }, 400));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Choose" }));

    expect(await screen.findByText("Jobber doesn't cover that workflow.")).toHaveRole("status");
    expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose" })).toBeEnabled();
  });

  it("takes a fuller name for screen readers and reports when it is the current choice", () => {
    renderButton(BUY_JOBBER, { pressed: true, label: "Choose Jobber for quotes and estimates" });

    expect(screen.getByRole("button", { name: "Choose Jobber for quotes and estimates" })).toHaveAttribute("aria-pressed", "true");
  });
});
