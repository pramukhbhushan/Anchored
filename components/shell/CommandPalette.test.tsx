import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { router, setLocation } from "@/test/next";
import { BUSINESSES } from "@/test/shell-fixtures";

// =============================================================================
// Module Overview
// =============================================================================
// The command palette as an owner drives it from the keyboard. It is mounted
// inside `AppShell`, which owns the Cmd+K and Ctrl+K shortcut: the shortcut
// opens it, typing filters it, the arrows and Enter go somewhere, and Escape
// closes it so the shortcut can open it again.

const PALETTE = { name: "Jump to a page or business" };

function renderShell() {
  return render(
    <AppShell businesses={BUSINESSES} initiallyCollapsed={false} account={null}>
      <p>Page content</p>
    </AppShell>,
  );
}

/** Return the open palette, or fail when it is closed. */
function palette(): HTMLElement {
  return screen.getByRole("dialog", PALETTE);
}

/** Press Escape the way a browser handles it in a modal dialog: a `cancel` event, then the dialog closes. */
async function pressEscape(): Promise<void> {
  await userEvent.keyboard("{Escape}");
  // happy-dom leaves out the browser's own Escape handling for modal dialogs, so this does that part.
  const open = document.querySelector("dialog[open]");
  if (open instanceof HTMLDialogElement && open.dispatchEvent(new Event("cancel", { cancelable: true }))) open.close();
}

/** Return the labels of the results the palette shows, in order. */
function results(): string[] {
  return within(palette())
    .queryAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("CommandPalette", () => {
  it("is closed until the owner asks for it", () => {
    renderShell();

    expect(screen.queryByRole("dialog", PALETTE)).not.toBeInTheDocument();
  });

  it("opens on Cmd+K with the search box focused", async () => {
    renderShell();

    await userEvent.keyboard("{Meta>}k{/Meta}");

    expect(palette()).toBeInTheDocument();
    expect(within(palette()).getByRole("combobox", { name: "Search pages and businesses" })).toHaveFocus();
  });

  it("opens on Ctrl+K", async () => {
    renderShell();

    await userEvent.keyboard("{Control>}k{/Control}");

    expect(palette()).toBeInTheDocument();
  });

  it("opens from the Jump to button in the top bar", async () => {
    renderShell();

    await userEvent.click(screen.getByRole("button", { name: /Jump to/ }));

    expect(palette()).toBeInTheDocument();
  });

  it("lists every business and the app-wide pages", async () => {
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");

    expect(results()).toEqual(
      expect.arrayContaining(["Rosa's Taqueria (example)", "Apex Heating", "Greenfield Lawn", "All businesses", "Start a new business"]),
    );
  });

  it("lists the open business's pages with their shortcuts", async () => {
    setLocation({ pathname: "/app/b/rosa", segments: ["b", "rosa"] });
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");

    expect(within(palette()).getByRole("option", { name: /^Workflows/ })).toBeInTheDocument();
    expect(within(palette()).getByLabelText("Shortcut g then w")).toBeInTheDocument();
  });

  it("filters the results as the owner types", async () => {
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");

    await userEvent.keyboard("rosa");

    expect(results()).toEqual(["Rosa's Taqueria (example)"]);
  });

  it("matches every typed word, in any order", async () => {
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");

    await userEvent.keyboard("example taq");

    expect(results()).toEqual(["Rosa's Taqueria (example)"]);
  });

  it("says so when nothing matches", async () => {
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");

    await userEvent.keyboard("zzzz");

    expect(results()).toEqual([]);
    expect(within(palette()).getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("goes to the top result on Enter and closes", async () => {
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");

    await userEvent.keyboard("apex{Enter}");

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/b/apex");
    expect(screen.queryByRole("dialog", PALETTE)).not.toBeInTheDocument();
  });

  it("moves the highlight with the arrows and goes to the highlighted result", async () => {
    setLocation({ pathname: "/app/b/rosa", segments: ["b", "rosa"] });
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await userEvent.keyboard("businesses");
    expect(results()).toEqual(["Apex Heating", "Greenfield Lawn", "Rosa's Taqueria (example)", "All businesses"]);

    await userEvent.keyboard("{ArrowDown}");
    expect(within(palette()).getByRole("option", { name: "Greenfield Lawn" })).toHaveAttribute("aria-selected", "true");
    expect(within(palette()).getByRole("option", { name: "Apex Heating" })).toHaveAttribute("aria-selected", "false");

    await userEvent.keyboard("{Enter}");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/b/greenfield");
  });

  it("goes to a result the owner clicks", async () => {
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");

    await userEvent.click(within(palette()).getByRole("option", { name: "Start a new business" }));

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/new");
  });

  it("closes on Escape without going anywhere, and opens again on the shortcut", async () => {
    renderShell();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await userEvent.keyboard("rosa");

    await pressEscape();
    expect(screen.queryByRole("dialog", PALETTE)).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    await userEvent.keyboard("{Control>}k{/Control}");
    expect(palette()).toBeInTheDocument();
    // A fresh search each time it opens.
    expect(within(palette()).getByRole("combobox")).toHaveValue("");
  });
});
