import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/account/AccountMenu";
import { ToastProvider } from "@/components/ui/Toast";
import type { Viewer } from "@/lib/auth/viewer";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

const updateUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/browser", () => ({ createBrowserSupabase: () => ({ auth: { updateUser } }) }));

// =============================================================================
// Module Overview
// =============================================================================
// The account menu: who is signed in, "Sign out" when accounts are on, "Save
// your work" for a guest, and "Start fresh" and "Delete my businesses", which
// ask first and then clear everything the visitor saved. With accounts off it
// names the browser and has no sign-out.

const SIGNED_IN: Viewer = { id: "u_1", email: "rosa@linden.example", isGuest: false, authEnabled: true };
const GUEST: Viewer = { id: "u_2", email: null, isGuest: true, authEnabled: true };
const ACCOUNTS_OFF: Viewer = { id: "s_1", email: null, isGuest: true, authEnabled: false };

function renderMenu(viewer: Viewer) {
  return render(
    <ToastProvider>
      <AccountMenu viewer={viewer} />
    </ToastProvider>,
  );
}

async function openMenu(name: RegExp) {
  await userEvent.click(screen.getByRole("button", { name }));
}

function confirmation(): HTMLElement {
  return screen.getByRole("group", { name: "Confirm deleting your businesses" });
}

describe("AccountMenu", () => {
  it("shows a signed-in owner their email and a sign-out that posts to the sign-out route", async () => {
    renderMenu(SIGNED_IN);
    await openMenu(/rosa@linden\.example/);

    const signOut = screen.getByRole("button", { name: "Sign out" });
    const form = signOut.closest("form");
    expect(form).toHaveAttribute("action", "/auth/signout");
    expect(form).toHaveAttribute("method", "post");
    expect(screen.queryByRole("button", { name: "Save your work" })).not.toBeInTheDocument();
  });

  it("offers a guest a way to save their work as well as sign out", async () => {
    renderMenu(GUEST);
    await openMenu(/Guest/);

    expect(screen.getByRole("button", { name: "Save your work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("names this browser and has no sign-out when accounts are off", async () => {
    renderMenu(ACCOUNTS_OFF);
    await openMenu(/This browser/);

    expect(screen.getByText(/tied to this browser/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save your work" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete my businesses" })).toBeInTheDocument();
  });

  it("asks before deleting anything, saying it can't be undone", async () => {
    const fetchSpy = stubFetch(() => json({ ok: true }));
    renderMenu(SIGNED_IN);
    await openMenu(/rosa@linden\.example/);

    await userEvent.click(screen.getByRole("button", { name: "Delete my businesses" }));

    expect(confirmation()).toHaveTextContent(/can't be undone/);
    expect(within(confirmation()).getByRole("button", { name: "Delete everything" })).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("starts fresh once confirmed: clears everything and opens a new onboarding", async () => {
    const fetchSpy = stubFetch(() => json({ ok: true }));
    renderMenu(SIGNED_IN);
    await openMenu(/rosa@linden\.example/);

    await userEvent.click(screen.getByRole("button", { name: "Start fresh" }));
    const confirm = screen.getByRole("group", { name: "Confirm starting fresh" });
    expect(confirm).toHaveTextContent(/can't be undone/);
    await userEvent.click(within(confirm).getByRole("button", { name: "Clear and start" }));

    expect(await screen.findByText("Ready for a fresh business")).toHaveRole("status");
    expect(sentJson(fetchSpy, 0)).toMatchObject({ method: "DELETE", url: "/api/businesses" });
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/new");
  });

  it("backs out on Cancel without deleting anything", async () => {
    const fetchSpy = stubFetch(() => json({ ok: true }));
    renderMenu(SIGNED_IN);
    await openMenu(/rosa@linden\.example/);

    await userEvent.click(screen.getByRole("button", { name: "Delete my businesses" }));
    await userEvent.click(within(confirmation()).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: "Confirm deleting your businesses" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete my businesses" })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("deletes once confirmed, says so, and returns to the business list", async () => {
    const fetchSpy = stubFetch(() => json({ ok: true }));
    renderMenu(SIGNED_IN);
    await openMenu(/rosa@linden\.example/);

    await userEvent.click(screen.getByRole("button", { name: "Delete my businesses" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));

    expect(await screen.findByText("Your businesses are deleted")).toHaveRole("status");
    expect(sentJson(fetchSpy, 0)).toMatchObject({ method: "DELETE", url: "/api/businesses" });
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("can't be confirmed twice while the delete runs, and shows why it failed", async () => {
    const answer = deferred<Response>();
    const fetchSpy = stubFetch(() => answer.promise);
    renderMenu(SIGNED_IN);
    await openMenu(/rosa@linden\.example/);

    await userEvent.click(screen.getByRole("button", { name: "Delete my businesses" }));
    await userEvent.click(within(confirmation()).getByRole("button", { name: "Delete everything" }));

    for (const button of within(confirmation()).getAllByRole("button")) expect(button).toBeDisabled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    answer.resolve(json({ error: "Too many requests. Wait 2 minutes and try again." }, 429));
    expect(await screen.findByText("Too many requests. Wait 2 minutes and try again.")).toBeInTheDocument();
    await waitFor(() => expect(within(confirmation()).getByRole("button", { name: "Delete everything" })).toBeEnabled());
    expect(router.push).not.toHaveBeenCalled();
  });

  it("says a guest's work is saved when the email change applies at once, whatever its case", async () => {
    // Supabase stores the address lower-cased and, with email confirmation off, sends no link.
    updateUser.mockResolvedValueOnce({ data: { user: { email: "rosa@linden.example" } }, error: null });
    renderMenu(GUEST);
    await openMenu(/Guest/);

    await userEvent.click(screen.getByRole("button", { name: "Save your work" }));
    await userEvent.type(screen.getByLabelText("Email to save your work to"), "Rosa@Linden.example");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));

    expect(await screen.findByText(/Saved\. Your work is now kept under/)).toHaveRole("status");
    expect(screen.queryByText(/Check your email/)).not.toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith({ email: "Rosa@Linden.example" }, expect.anything());
  });

  it("tells a guest to check their email while the change waits on a link", async () => {
    updateUser.mockResolvedValueOnce({ data: { user: { email: null, new_email: "rosa@linden.example" } }, error: null });
    renderMenu(GUEST);
    await openMenu(/Guest/);

    await userEvent.click(screen.getByRole("button", { name: "Save your work" }));
    await userEvent.type(screen.getByLabelText("Email to save your work to"), "rosa@linden.example");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));

    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
  });
});
