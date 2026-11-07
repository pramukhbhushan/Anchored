import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ResetDemoButton } from "@/components/shell/ResetDemoButton";
import { ToastProvider } from "@/components/ui/Toast";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// "Reset demo" deletes the session's work, so the first press only asks: it
// says what goes, naming how many of the owner's businesses, and the second
// press resets and returns to the business list.

function renderButton(ownCount: number) {
  return render(
    <ToastProvider>
      <ResetDemoButton ownCount={ownCount} />
    </ToastProvider>,
  );
}

function confirmation(): HTMLElement {
  return screen.getByRole("group", { name: "Confirm reset" });
}

describe("ResetDemoButton", () => {
  it("asks before deleting anything, saying how many of the owner's businesses go", async () => {
    const fetchSpy = stubFetch(() => json({ ok: true }));
    renderButton(2);

    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));

    expect(confirmation()).toHaveTextContent("your 2 businesses");
    expect(within(confirmation()).getByRole("button", { name: "Delete and reset" })).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("counts one business in the singular, and names none when the owner has none", async () => {
    const { unmount } = renderButton(1);
    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(confirmation()).toHaveTextContent("your 1 business,");
    unmount();

    renderButton(0);
    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(confirmation()).not.toHaveTextContent(/your \d+ business/);
  });

  it("backs out on Cancel without deleting anything", async () => {
    const fetchSpy = stubFetch(() => json({ ok: true }));
    renderButton(2);

    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    await userEvent.click(within(confirmation()).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: "Confirm reset" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resets once confirmed, says so, and returns to the business list", async () => {
    const fetchSpy = stubFetch(() => json({ ok: true }));
    renderButton(2);

    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete and reset" }));

    expect(await screen.findByText("Demo reset")).toHaveRole("status");
    expect(sentJson(fetchSpy, 0)).toMatchObject({ method: "POST", url: "/api/reset" });
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("can't be confirmed twice while the reset runs", async () => {
    const answer = deferred<Response>();
    const fetchSpy = stubFetch(() => answer.promise);
    renderButton(2);

    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    await userEvent.click(within(confirmation()).getByRole("button", { name: "Delete and reset" }));

    for (const button of within(confirmation()).getAllByRole("button")) expect(button).toBeDisabled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    answer.resolve(json({ ok: true }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it("shows the route's reason when the reset fails, and stays on the business", async () => {
    stubFetch(() => json({ error: "Couldn't reset right now." }, 500));
    renderButton(2);

    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete and reset" }));

    expect(await screen.findByText("Couldn't reset right now.")).toHaveRole("status");
    expect(router.push).not.toHaveBeenCalled();
    expect(within(confirmation()).getByRole("button", { name: "Delete and reset" })).toBeEnabled();
  });
});
