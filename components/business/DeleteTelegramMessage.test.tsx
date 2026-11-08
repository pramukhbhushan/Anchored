import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { deferred, json, sentJson, stubFetch } from "@/test/http";
import { DeleteTelegramMessage } from "./DeleteTelegramMessage";

// =============================================================================
// Module Overview
// =============================================================================
// The outbox removal control sends stored identity only, prevents duplicate
// taps and keeps the provider's truthful result visible to the owner.

describe("Telegram removal control", () => {
  it("submits explicit confirmation once and displays the authoritative result", async () => {
    const pending = deferred<Response>();
    const fetch = stubFetch(() => pending.promise);
    render(<DeleteTelegramMessage businessId="shop/id" entryId="entry" />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Remove from Telegram" });
    await user.click(button);
    await user.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sentJson(fetch, 0)).toEqual({ method: "POST", url: "/api/businesses/shop%2Fid/outbox/entry/delete", body: { confirm: true } });
    pending.resolve(json({ deleted: true, message: "Removed from Telegram. Someone may already have read it." }));
    expect(await screen.findByRole("status")).toHaveTextContent("Someone may already have read it");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("shows an expired-window error and leaves the original send intact", async () => {
    stubFetch(() => json({ error: "The removal window expired." }, 409));
    render(<DeleteTelegramMessage businessId="shop" entryId="entry" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove from Telegram" }));
    expect(await screen.findByRole("status")).toHaveTextContent("removal window expired");
    expect(screen.getByRole("button", { name: "Remove from Telegram" })).toBeEnabled();
  });
});
