import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AiKeyCard } from "@/components/connections/AiKeyCard";
import type { AiKeyView, ConnectionsResponse } from "@/lib/api/contract";
import { json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's AI key on the Connections page, as an owner uses it: with no key
// the card says what writes drafts meanwhile; saving one sends the provider,
// key and model to the AI key route and then shows the provider and the key's
// last four characters, never the key; a key the provider turns down shows the
// route's reason; every provider but Anthropic asks for a model; Remove key
// sends the removal; and a visitor who can't connect sees no form.

const KEY = "sk-owner-test-key-abcd1234";
const NO_KEY: AiKeyView = { provider: null, lastFour: null, model: null, fallback: "rules", unavailable: null };
const SAVED: AiKeyView = { provider: "openai", lastFour: "1234", model: "gpt-test", fallback: "rules", unavailable: null };

/** The route's answer carrying `ai`. */
function answer(ai: AiKeyView): ConnectionsResponse {
  return { blocked: null, ai, connections: [], contacts: [] };
}

/** The AI key card. */
function card() {
  return within(screen.getByRole("region", { name: "Your AI key" }));
}

describe("AiKeyCard", () => {
  it("says the rules write drafts until a key is added, or the server's AI when it has one", () => {
    const { unmount } = render(<AiKeyCard businessId="b1" view={NO_KEY} canChange />);
    expect(card().getByText("No key yet")).toBeInTheDocument();
    expect(card().getByText("Until you add one, Anchored writes drafts from its own templates.")).toBeInTheDocument();
    unmount();

    render(<AiKeyCard businessId="b1" view={{ ...NO_KEY, fallback: "server" }} canChange />);
    expect(card().getByText("Until you add one, Anchored writes drafts with this server's AI.")).toBeInTheDocument();
  });

  it("checks and saves an OpenAI key with its model, then shows the provider and key end but not the key", async () => {
    const fetchSpy = stubFetch(() => json(answer(SAVED)));
    render(<AiKeyCard businessId="b1" view={NO_KEY} canChange />);

    await userEvent.selectOptions(card().getByLabelText("Provider"), "OpenAI");
    expect(card().getByLabelText("Model")).toBeRequired();
    expect(card().getByText("Copy the model's exact name from OpenAI.")).toBeInTheDocument();
    await userEvent.type(card().getByLabelText("API key"), KEY);
    await userEvent.type(card().getByLabelText("Model"), "gpt-test");
    await userEvent.click(card().getByRole("button", { name: "Check and save" }));

    expect(sentJson(fetchSpy, 0)).toEqual({ method: "PUT", url: "/api/businesses/b1/ai-key", body: { provider: "openai", apiKey: KEY, model: "gpt-test" } });
    expect(await card().findByText("Connected: OpenAI key ending in 1234, model gpt-test")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(KEY))).not.toBeInTheDocument();
    expect(card().getByText("Use a different key")).toBeInTheDocument();
  });

  it("lets an Anthropic key leave the model blank", async () => {
    const fetchSpy = stubFetch(() => json(answer({ ...SAVED, provider: "anthropic", model: null })));
    render(<AiKeyCard businessId="b1" view={NO_KEY} canChange />);

    expect(card().getByLabelText("Model")).not.toBeRequired();
    await userEvent.type(card().getByLabelText("API key"), KEY);
    await userEvent.click(card().getByRole("button", { name: "Check and save" }));

    expect(sentJson(fetchSpy, 0).body).toEqual({ provider: "anthropic", apiKey: KEY });
    expect(await card().findByText("Connected: Anthropic key ending in 1234")).toBeInTheDocument();
  });

  it("shows the route's reason when the provider turns the key down, and keeps the card unconnected", async () => {
    stubFetch(() => json({ error: "Anthropic turned down this key. Copy the whole key from your Anthropic account and paste it again." }, 400));
    render(<AiKeyCard businessId="b1" view={NO_KEY} canChange />);

    await userEvent.type(card().getByLabelText("API key"), KEY);
    await userEvent.click(card().getByRole("button", { name: "Check and save" }));

    expect(await card().findByRole("alert")).toHaveTextContent("Anthropic turned down this key. Copy the whole key from your Anthropic account and paste it again.");
    expect(card().getByText("No key yet")).toBeInTheDocument();
  });

  it("removes a saved key", async () => {
    const fetchSpy = stubFetch(() => json(answer(NO_KEY)));
    render(<AiKeyCard businessId="b1" view={SAVED} canChange />);

    await userEvent.click(card().getByRole("button", { name: "Remove key" }));

    expect(sentJson(fetchSpy, 0)).toMatchObject({ method: "DELETE", url: "/api/businesses/b1/ai-key" });
    expect(await card().findByText("No key yet")).toBeInTheDocument();
  });

  it("shows no form to a visitor who can't connect, and says why when the server can't keep keys", () => {
    const { unmount } = render(<AiKeyCard businessId="b1" view={SAVED} canChange={false} />);
    expect(card().getByText("Connected: OpenAI key ending in 1234, model gpt-test")).toBeInTheDocument();
    expect(card().queryByRole("button")).not.toBeInTheDocument();
    unmount();

    render(<AiKeyCard businessId="b1" view={{ ...NO_KEY, unavailable: "Not available yet." }} canChange />);
    expect(card().getByText("Not available yet.")).toBeInTheDocument();
    expect(card().queryByLabelText("API key")).not.toBeInTheDocument();
  });
});
