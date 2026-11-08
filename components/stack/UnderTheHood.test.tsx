import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnderTheHood } from "@/components/stack/UnderTheHood";
import { activeAgents, resolveChoices } from "@/lib/domain/paths";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's "Under the hood": each skill names the model this server
// actually runs, or says the rules write the drafts when no model is set up.

const SHOP = hvacShop();
const AGENTS = activeAgents(SHOP, resolveChoices(SHOP, {}));

describe("UnderTheHood", () => {
  it("names the model this server runs for each skill, with its provider", () => {
    const ai = { label: "Featherless", models: { quick: "qwen-small", default: "qwen-large", complex: "qwen-xl" } };
    render(<UnderTheHood business={SHOP} agents={AGENTS} tools={[]} ai={ai} />);

    expect(screen.getAllByText(/qwen-small on Featherless, quick tier/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Claude (Haiku|Sonnet|Opus)/)).not.toBeInTheDocument();
  });

  it("says the rules write the drafts when no model is set up", () => {
    render(<UnderTheHood business={SHOP} agents={AGENTS} tools={[]} ai={null} />);

    expect(screen.getAllByText(/No AI model is set up here, so Anchored's rules write these drafts/).length).toBeGreaterThan(0);
  });
});
