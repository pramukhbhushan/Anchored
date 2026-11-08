import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AutomationSwitch } from "@/components/workflows/AutomationSwitch";
import { json, sentJson, stubFetch } from "@/test/http";
import { router } from "@/test/next";

// =============================================================================
// Module Overview
// =============================================================================
// The on/off switch on the Automations page, as an owner uses it: it says
// whether the job is on, saves a flip at once and refreshes the page, links
// to Chat when turning it on asked a question there, says why a flip failed,
// and can't be flipped on the example.

const URL_ = "/api/businesses/rosa/automations";

function renderSwitch(on: boolean, disabledReason: string | null = null) {
  render(<AutomationSwitch businessId="rosa" workflow="social" jobName="Social posts and marketing" on={on} chatHref="/app/b/rosa/chat" disabledReason={disabledReason} />);
  return screen.getByRole("switch", { name: `Social posts and marketing: ${on ? "on" : "off"}` });
}

describe("AutomationSwitch", () => {
  it("turns a job on, refreshes the page, and links to the question it asked in Chat", async () => {
    const user = userEvent.setup();
    const fetchSpy = stubFetch(() => json({ choice: { path: "build", skills: ["posts"] }, asked: true }));
    const toggle = renderSwitch(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(sentJson(fetchSpy, 0)).toEqual({ method: "PUT", url: URL_, body: { workflow: "social", on: true } });
  });

  it("shows the Chat link once the page says the job is on", async () => {
    const user = userEvent.setup();
    stubFetch(() => json({ choice: { path: "build", skills: ["posts"] }, asked: true }));
    const { rerender } = render(<AutomationSwitch businessId="rosa" workflow="social" jobName="Social posts and marketing" on={false} chatHref="/app/b/rosa/chat" disabledReason={null} />);
    await user.click(screen.getByRole("switch"));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    rerender(<AutomationSwitch businessId="rosa" workflow="social" jobName="Social posts and marketing" on chatHref="/app/b/rosa/chat" disabledReason={null} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: "Answer in Chat" })).toHaveAttribute("href", "/app/b/rosa/chat");
  });

  it("turns a job off", async () => {
    const user = userEvent.setup();
    const fetchSpy = stubFetch(() => json({ choice: { path: "skip" }, asked: false }));
    await user.click(renderSwitch(true));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(sentJson(fetchSpy, 0).body).toEqual({ workflow: "social", on: false });
  });

  it("says why a flip failed", async () => {
    const user = userEvent.setup();
    stubFetch(() => json({ error: "Anchored doesn't draft this job, and you don't have an app for it yet. Pick one under Compare apps." }, 409));
    await user.click(renderSwitch(false));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pick one under Compare apps.");
  });

  it("can't be flipped on the example", () => {
    expect(renderSwitch(true, "This is an example. Set up your business to turn jobs on.")).toBeDisabled();
  });
});
