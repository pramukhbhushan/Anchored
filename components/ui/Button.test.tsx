import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, ButtonLink } from "@/components/ui/Button";

// =============================================================================
// Module Overview
// =============================================================================
// What an owner gets from Anchored's two button shapes: `Button` acts in place
// and never submits a form by accident, and `ButtonLink` is a real link.

describe("Button", () => {
  it("runs its action when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not submit the form it sits in unless asked to", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button>Add a line</Button>
        <Button type="submit">Send</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add a line" }));
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("ignores presses while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ButtonLink", () => {
  it("renders a link to its href, not a button", () => {
    render(<ButtonLink href="/app/new">Start a new business</ButtonLink>);

    expect(screen.getByRole("link", { name: "Start a new business" })).toHaveAttribute("href", "/app/new");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
