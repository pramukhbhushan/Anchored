import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TelegramSetup } from "./TelegramSetup";

// =============================================================================
// Module Overview
// =============================================================================
// The Telegram setup as an owner uses it, including unavailable links,
// browser clipboard limits and the optional real QR supplied by the caller.

const URL = "https://t.me/anchored_test_bot?start=business-123";

describe("TelegramSetup", () => {
  it("shows a usable link without requiring connected credentials", async () => {
    const user = userEvent.setup();
    render(<TelegramSetup businessId="shop" url={URL} />);
    expect(screen.getByRole("link", { name: "Open Telegram" })).toHaveAttribute("href", URL);
    expect(screen.getByRole("link", { name: "Open Telegram" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("textbox", { name: "Your business's test link" })).toHaveValue(URL);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(URL);
    expect(screen.getByRole("status")).toHaveTextContent("Copied.");
    expect(screen.queryByText(/Scan to open/)).not.toBeInTheDocument();
  });

  it.each(["javascript:alert(1)", "http://t.me/anchored_bot?start=abc", "https://t.me.evil.test/anchored_bot?start=abc", "https://user:secret@t.me/anchored_bot?start=abc", "https://t.me/anchored_bot?start=abc&start=other", "https://t.me/anchored_bot"]) ("doesn't offer an unsafe or incomplete link: %s", (url) => {
    render(<TelegramSetup businessId="shop" url={url} />);
    expect(screen.queryByRole("link", { name: "Open Telegram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
  });

  it("explains unavailable setup and leaves the shared example read-only", () => {
    render(<TelegramSetup businessId="example" url={null} unavailableReason="Set up your own business to get a Telegram test link." />);
    expect(screen.getByText("Set up your own business to get a Telegram test link.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps the link selectable when the clipboard is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("Blocked"));
    const previous = Object.getOwnPropertyDescriptor(document, "execCommand");
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
    try {
      render(<TelegramSetup businessId="shop" url={URL} />);
      await user.click(screen.getByRole("button", { name: "Copy link" }));
      expect(screen.getByRole("status")).toHaveTextContent("Select the test link above");
      expect(screen.getByRole("textbox", { name: "Your business's test link" })).toHaveValue(URL);
    } finally {
      if (previous === undefined) Reflect.deleteProperty(document, "execCommand");
      else Object.defineProperty(document, "execCommand", previous);
    }
  });

  it("renders a supplied real QR alongside the ordinary link", () => {
    render(<TelegramSetup businessId="shop" url={URL} qrCode={<svg role="img" aria-label="Telegram test link QR code" />} />);
    expect(screen.getByRole("img", { name: "Telegram test link QR code" })).toBeInTheDocument();
    expect(screen.getByText("Scan to open your business's Telegram chat.")).toBeInTheDocument();
  });
});
