import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// One automation's page against a real in-memory store: a known automation
// renders under its own name, and a link that names no automation of the
// business, malformed or not, is a 404 rather than an error page.

const SESSION = "automation-page-owner";
const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));
vi.mock("next/navigation", async () => ({
  ...(await import("@/test/next")).navigation,
  notFound: () => {
    throw new Error("not-found");
  },
}));

const { default: AutomationPage } = await import("./page");
const SHOP = hvacShop();

/** Page props for automation `automation` in workflow `workflow` of the test shop. */
function params(workflow: string, automation: string) {
  return { params: Promise.resolve({ id: SHOP.id, workflow, automation }) };
}

beforeEach(async () => {
  stores.current = new MemoryStore();
  await stores.current.saveBusiness(SESSION, SHOP);
  await stores.current.setChoice(SESSION, SHOP.id, "quotes", { path: "build", skills: ["closer"] });
});

describe("Automation page", () => {
  it("renders a known automation under its name", async () => {
    render(await AutomationPage(params("quotes", "closer")));

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });

  it("is not found for a key the workflow doesn't have", async () => {
    await expect(AutomationPage(params("quotes", "no-such-step"))).rejects.toThrow("not-found");
  });

  it("is not found, not an error, for a malformed key", async () => {
    await expect(AutomationPage(params("quotes", "%E0%A4%A"))).rejects.toThrow("not-found");
  });
});
