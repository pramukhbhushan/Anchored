import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AskInChat } from "@/components/workflows/AskInChat";
import { POST_BRIEF_QUESTION } from "@/lib/domain/posts";
import { router } from "@/test/next";

// =============================================================================
// Module Overview
// =============================================================================
// The chat box on an automation page: the owner types an answer or a note and
// Continue in Chat carries it to the business chat's text box.

describe("AskInChat", () => {
  it("carries the owner's words to the chat", async () => {
    const user = userEvent.setup();
    render(<AskInChat chatHref="/app/b/rosa/chat" prompt={POST_BRIEF_QUESTION} placeholder="Our weekend workshop" />);

    await user.type(screen.getByRole("textbox", { name: POST_BRIEF_QUESTION }), "Our open house & tour");
    await user.click(screen.getByRole("button", { name: "Continue in Chat" }));

    expect(router.push).toHaveBeenCalledWith("/app/b/rosa/chat?ask=Our%20open%20house%20%26%20tour");
  });

  it("opens the chat when the box is empty", async () => {
    const user = userEvent.setup();
    render(<AskInChat chatHref="/app/b/rosa/chat" prompt="Ask Anchored" placeholder="" />);
    await user.click(screen.getByRole("button", { name: "Continue in Chat" }));
    expect(router.push).toHaveBeenCalledWith("/app/b/rosa/chat");
  });
});
