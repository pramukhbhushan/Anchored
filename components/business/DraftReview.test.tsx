import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DraftReview } from "./DraftReview";
import { ToastProvider } from "@/components/ui/Toast";
import type { CardRecord } from "@/lib/api/contract";
import { json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// A brief draft stays read-only until opened and deliberately approved. These
// checks exercise the actual card request, editing and keyboard dismissal.

const card: CardRecord = {
  id: "draft-1",
  key: "quote:1",
  businessId: "shop",
  status: "pending",
  edited: false,
  createdAt: "2026-11-08T12:00:00Z",
  decidedAt: null,
  agent: "followup",
  skill: "closer",
  title: "Follow up on a quote",
  body: "Hi Pat, would you like to talk about your quote?",
  reason: "No reply to the quote.",
  checks: [],
  action: "Send email",
  channel: "email",
  to: "Pat",
};
function show() {
  render(
    <ToastProvider>
      <DraftReview
        card={card}
        source="Customer agent"
        canRewrite={false}
        business={{ name: "Shop", reach: [], tools: [] }}
      />
    </ToastProvider>,
  );
}

describe("Morning draft review", () => {
  it("opens without sending, then restores focus when Escape closes it", async () => {
    const fetch = stubFetch(() => json({}));
    show();
    const trigger = screen.getByRole("button", { name: card.title });
    await userEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Review this draft" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
  it("sends only the edited words through the existing approval route", async () => {
    const fetch = stubFetch(() =>
      json({ card: { ...card, status: "approved" }, outbox: null }),
    );
    show();
    await userEvent.click(screen.getByRole("button", { name: card.title }));
    const panel = screen.getByRole("dialog");
    await userEvent.click(within(panel).getByRole("button", { name: /^Edit/ }));
    const input = within(panel).getByRole("textbox", {
      name: "Edit the draft",
    });
    await userEvent.clear(input);
    await userEvent.type(input, "Hi Pat, how can I help?");
    await userEvent.click(
      within(panel).getByRole("button", { name: /Approve/ }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(sentJson(fetch, 0)).toEqual({
      method: "POST",
      url: "/api/cards/draft-1",
      body: { decision: "approve", body: "Hi Pat, how can I help?" },
    });
  });
});
