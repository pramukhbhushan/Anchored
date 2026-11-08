import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetupChat } from "./SetupChat";

// =============================================================================
// Module Overview
// =============================================================================
// The setup chat above a business's chat: closed by default with the day and
// message count, each message labeled with who said it, and nothing at all
// for a business with no onboarding chat.

const MESSAGES = [
  { id: "1", role: "anchored" as const, text: "What's your business called, and what town is it in?", at: "2026-11-08T15:00:00Z" },
  { id: "2", role: "owner" as const, text: "Brightpath Coaching, College Park", at: "2026-11-08T15:00:05Z" },
];

describe("SetupChat", () => {
  it("shows the onboarding conversation, closed, with who said each line", () => {
    const { container } = render(<SetupChat messages={MESSAGES} />);
    expect(container.querySelector("details")?.open).toBe(false);
    expect(screen.getByText(/Your setup chat, Nov 8/)).toBeTruthy();
    expect(screen.getByText("(2 messages)")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Your setup chat" });
    expect(list.textContent).toContain("YouBrightpath Coaching, College Park");
    expect(list.textContent).toContain("AnchoredWhat's your business called");
  });

  it("renders nothing without a setup chat", () => {
    const { container } = render(<SetupChat messages={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
