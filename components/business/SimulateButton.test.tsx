import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SimulateButton } from "@/components/business/SimulateButton";
import { ToastProvider } from "@/components/ui/Toast";
import type { CardRecord, EventCardResponse } from "@/lib/api/contract";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// "Watch an agent draft" asks the cards route for one more draft, says who
// drafted it with a link to see it, and refreshes the feed.

const ADDED: CardRecord = {
  id: "card-9",
  key: "followup:closer:9",
  businessId: "restaurant",
  status: "pending",
  edited: false,
  createdAt: "2026-11-06T16:00:00Z",
  decidedAt: null,
  agent: "followup",
  skill: "closer",
  title: "Follow up on the Okafor quote",
  body: "Hi Ade, any questions on the quote?",
  reason: "Quote sent 4 days ago.",
  checks: [],
  action: "Send text",
  channel: "sms",
};

function answer(added: CardRecord | null): Response {
  return json({ cards: [], outbox: [], added } satisfies EventCardResponse);
}

function renderButton() {
  return render(
    <ToastProvider>
      <SimulateButton businessId="restaurant" agentNames={{ followup: "Follow-up" }} seeHref="#waiting" />
    </ToastProvider>,
  );
}

describe("SimulateButton", () => {
  it("drafts a new card, says which agent drafted it with a link to it, and refreshes the feed", async () => {
    const fetchSpy = stubFetch(() => answer(ADDED));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Watch an agent draft" }));

    const toast = await screen.findByText(/Customer agent/);
    expect(toast).toHaveRole("status");
    expect(within(toast).getByRole("link", { name: "See it" })).toHaveAttribute("href", "#waiting");
    expect(sentJson(fetchSpy, 0)).toEqual({ method: "POST", url: "/api/businesses/restaurant/cards", body: {} });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("still confirms the new card when the route can't name it", async () => {
    stubFetch(() => answer(null));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Watch an agent draft" }));

    expect(await screen.findByRole("link", { name: "See it" })).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("can't be pressed again while the draft is on its way", async () => {
    const pending = deferred<Response>();
    const fetchSpy = stubFetch(() => pending.promise);
    renderButton();

    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    pending.resolve(answer(ADDED));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("shows the route's reason when no card can be drafted", async () => {
    stubFetch(() => json({ error: "Pick a path that uses an agent first." }, 400));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Watch an agent draft" }));

    expect(await screen.findByText("Pick a path that uses an agent first.")).toHaveRole("status");
    expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Watch an agent draft" })).toBeEnabled();
  });
});
