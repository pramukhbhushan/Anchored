import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFrame } from "@/components/site/SiteFrame";
import { ToastProvider } from "@/components/ui/Toast";
import type { Viewer } from "@/lib/auth/viewer";
import { setLocation } from "@/test/next";

// =============================================================================
// Module Overview
// =============================================================================
// The site header on "How it's built" and the landing page's own header:
// "Sign in" (or "Log in" on the landing page) for a signed-out visitor, "Open
// app" plus the account menu once signed in, and "Open app" alone when
// accounts are off. Inside `/app` it steps aside.

const SIGNED_IN: Viewer = { id: "u_1", email: "rosa@linden.example", isGuest: false, authEnabled: true };

function renderFrame(authEnabled: boolean, viewer: Viewer | null) {
  return render(
    <ToastProvider>
      <SiteFrame authEnabled={authEnabled} viewer={viewer}>
        <p>Page</p>
      </SiteFrame>
    </ToastProvider>,
  );
}

function header(): HTMLElement {
  return screen.getByRole("banner");
}

describe("SiteFrame", () => {
  it("asks a signed-out visitor to sign in", () => {
    setLocation({ pathname: "/built" });
    renderFrame(true, null);

    expect(within(header()).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(within(header()).queryByRole("link", { name: "Open app" })).not.toBeInTheDocument();
    expect(within(header()).queryByRole("button", { name: /account menu/ })).not.toBeInTheDocument();
  });

  it("offers a signed-in owner the app and their account menu instead", () => {
    setLocation({ pathname: "/built" });
    renderFrame(true, SIGNED_IN);

    expect(within(header()).getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/app");
    expect(within(header()).getByRole("button", { name: /rosa@linden\.example/ })).toBeInTheDocument();
    expect(within(header()).queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("opens the app directly when accounts are off", () => {
    setLocation({ pathname: "/built" });
    renderFrame(false, null);

    expect(within(header()).getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/app");
    expect(within(header()).queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("gives the landing page Log in, Get started and a theme toggle", () => {
    setLocation({ pathname: "/" });
    renderFrame(true, null);

    expect(within(header()).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(within(header()).getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/app/new");
    expect(within(header()).getByRole("button", { name: /Switch to (dark|light) mode/ })).toBeInTheDocument();
  });

  it("swaps Log in for the app and account menu on the landing page once signed in", () => {
    setLocation({ pathname: "/" });
    renderFrame(true, SIGNED_IN);

    expect(within(header()).getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/app");
    expect(within(header()).getByRole("button", { name: /rosa@linden\.example/ })).toBeInTheDocument();
    expect(within(header()).queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("leaves the app's own shell to draw everything under `/app`", () => {
    setLocation({ pathname: "/app/b/restaurant" });
    renderFrame(true, SIGNED_IN);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByText("Page")).toBeInTheDocument();
  });
});
