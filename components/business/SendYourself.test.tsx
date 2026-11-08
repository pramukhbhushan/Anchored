import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copyText, SendYourself } from "@/components/business/SendYourself";
import type { HandOff } from "@/components/business/handoff";

// =============================================================================
// Module Overview
// =============================================================================
// The send step under an approved draft in the outbox, as the owner uses it: a
// link into their own texting or email app, or Copy plus links to the places
// they paste a post.

const TEXT: HandOff = { kind: "open", label: "Send from your phone", href: "sms:?&body=Hi%20Dana" };

const POST: HandOff = {
  kind: "copy",
  what: "post",
  text: "Taking new bookings this month.",
  hint: "Paste it into a new post.",
  places: [{ label: "Open Instagram", href: "https://www.instagram.com/" }],
};

describe("SendYourself", () => {
  it("links an approved text to the owner's texting app", () => {
    render(<SendYourself handOff={TEXT} />);

    expect(screen.getByRole("link", { name: "Send from your phone" })).toHaveAttribute("href", "sms:?&body=Hi%20Dana");
  });

  it("copies a post's words and says so", async () => {
    const user = userEvent.setup();
    render(<SendYourself handOff={POST} />);

    await user.click(screen.getByRole("button", { name: "Copy post" }));

    expect(await navigator.clipboard.readText()).toBe("Taking new bookings this month.");
    expect(screen.getByRole("status")).toHaveTextContent("Copied. Now paste it.");
  });

  it("says where the post goes and opens that place in a new tab", () => {
    render(<SendYourself handOff={POST} />);

    expect(screen.getByText("Paste it into a new post.")).toBeInTheDocument();
    const instagram = screen.getByRole("link", { name: "Open Instagram" });
    expect(instagram).toHaveAttribute("href", "https://www.instagram.com/");
    expect(instagram).toHaveAttribute("target", "_blank");
  });

  it("offers Share only on a device with a share sheet", () => {
    const { unmount } = render(<SendYourself handOff={POST} />);
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    unmount();

    Object.defineProperty(navigator, "share", { configurable: true, value: async () => {} });
    try {
      render(<SendYourself handOff={POST} />);
      expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(navigator, "share");
    }
  });
});

describe("copyText", () => {
  it("removes its hidden fallback textarea even when copying throws", async () => {
    userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Clipboard denied"));
    Object.defineProperty(document, "execCommand", { configurable: true, value: () => { throw new Error("Copy denied"); } });
    const before = document.querySelectorAll("textarea").length;
    try {
      expect(await copyText("Private customer text")).toBe(false);
      expect(document.querySelectorAll("textarea")).toHaveLength(before);
      expect(document.body).not.toHaveTextContent("Private customer text");
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });
});
