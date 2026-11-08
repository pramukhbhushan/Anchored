import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OpenFromHash } from "./OpenFromHash";

// =============================================================================
// Module Overview
// =============================================================================
// Hash links must reveal saved decisions without letting a malformed URL
// break the approval page. These checks exercise the same browser events.

afterEach(() => { window.history.replaceState(null, "", "/"); });

describe("approval hash navigation", () => {
  it("ignores malformed hashes and still opens a later valid decision", () => {
    window.history.replaceState(null, "", "/#%");
    render(<><OpenFromHash /><details><summary>Decided</summary><article id="card-saved">Saved decision</article></details></>);
    const details = screen.getByText("Decided").closest("details");
    expect(details).not.toHaveAttribute("open");
    window.history.replaceState(null, "", "/#card-saved");
    fireEvent(window, new Event("hashchange"));
    expect(details).toHaveAttribute("open");
  });
});
