import { json, stubFetch } from "@/test/http";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKFLOW_IDS } from "@/lib/domain/workflows";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Verifies agent landing pages against the actual in-memory store and domain
// choices. Unknown or inactive agents are not found, while a failed read stays
// an error instead of being mistaken for a missing business or empty feed.

const SESSION = "agent-page-owner";
const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));
vi.mock("next/navigation", async () => ({
  ...(await import("@/test/next")).navigation,
  notFound: () => { throw new Error("not-found"); },
}));

const { default: AgentPage, generateMetadata } = await import("./page");
const SHOP = hvacShop();

function params(agent: string, id = SHOP.id, contact?: string) {
  return { params: Promise.resolve({ id, workflow: agent }), searchParams: Promise.resolve(contact === undefined ? {} : { contact }) };
}

beforeEach(async () => {
  stubFetch(() => json({ messages: [], changes: [] }));
  stores.current = new MemoryStore();
  await stores.current.saveBusiness(SESSION, SHOP);
  for (const workflow of WORKFLOW_IDS) {
    if (SHOP.workflows[workflow] !== undefined) await stores.current.setChoice(SESSION, SHOP.id, workflow, { path: "skip" });
  }
  await stores.current.setChoice(SESSION, SHOP.id, "leads", { path: "build", skills: ["inquiry"] });
  await stores.current.setChoice(SESSION, SHOP.id, "quotes", { path: "build", skills: ["closer"] });
  await stores.current.ensureCards(SESSION, SHOP.id, [{
    key: "hvac:inquiry:event-1",
    agent: "frontdesk",
    skill: "inquiry",
    title: "New inquiry for the HVAC shop",
    body: "Thanks for reaching out. What do you need help with?",
    reason: "A customer asked for help",
    checks: ["The owner approves the reply"],
    action: "Send email",
    channel: "email",
    to: "customer@example.com",
  }]);
});

describe("agent landing page", () => {
  it("shows the merged Customer workspace and links its real draft to the same Approvals queue", async () => {
    render(await AgentPage(params("customer")));
    expect(screen.getByRole("heading", { name: "Customer", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New inquiry for the HVAC shop" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Review in Approvals" }).map((link) => link.getAttribute("href"))).toContain("/app/b/hvac/approvals#card-hvac-inquiry-event-1");
    expect(screen.getByRole("link", { name: "Workflows" })).toHaveAttribute("href", "/app/b/hvac/workflows");
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("names the tab after the validated active agent", async () => {
    await expect(generateMetadata(params("customer"))).resolves.toEqual({ title: "Customer" });
  });

  it("keeps always-on Internal Communications available without enabling unrelated workflows", async () => {
    render(await AgentPage(params("internal")));
    expect(screen.getByRole("heading", { level: 1, name: "Internal Communications" })).toBeInTheDocument();
    expect(screen.queryByText("New inquiry for the HVAC shop")).not.toBeInTheDocument();
    await expect(stores.current?.getChoices(SESSION, SHOP.id)).resolves.toMatchObject({ books: { path: "skip" } });
  });

  it.each(["unknown", "books", "frontdesk", "niche:missing"])("does not open an unknown or inactive workspace: %s", async (agent) => {
    await expect(AgentPage(params(agent))).rejects.toThrow("not-found");
  });

  it("opens an active niche workspace without replacing it with a core agent", async () => {
    await stores.current?.saveBusiness(SESSION, {
      ...SHOP,
      workflows: { ...SHOP.workflows, snap: { fit: 2, rec: "build", why: "Keep required stock visible", stake: "", isNew: true } },
      nicheAgents: [{ id: "niche:stock-check", name: "Stock Check", job: "Checks the stock list", skills: ["stockcheck"], workflow: "snap", spawnedBecause: "We keep a stock list", approval: "every-card" }],
    });
    await stores.current?.setChoice(SESSION, SHOP.id, "snap", { path: "build", skills: ["stockcheck"] });
    render(await AgentPage(params("niche:stock-check")));
    expect(screen.getByRole("heading", { level: 1, name: "Stock Check" })).toBeInTheDocument();
    await expect(generateMetadata(params("niche:stock-check"))).resolves.toEqual({ title: "Stock Check" });
  });

  it("shows the Customer's Telegram conversations from the server, never another session's", async () => {
    const store = stores.current;
    if (store === null) throw new Error("Missing store");
    const dana = await store.saveContact(SESSION, { businessId: SHOP.id, name: "Dana Ruiz", phone: null, email: null, consent: { source: "messaged-first", at: "2026-11-08T10:00:00Z" }, optedOutAt: null, telegramChatId: "42" });
    await store.addThreadMessage(SESSION, { businessId: SHOP.id, contactId: dana.id, direction: "in", text: "Do you service heat pumps?", skill: null, cardKey: null, outboxId: null, providerId: null, at: "2026-11-08T10:01:00Z" });
    render(await AgentPage(params("customer", SHOP.id, dana.id)));
    expect(screen.getAllByText("Do you service heat pumps?").length).toBeGreaterThan(0);
    expect(screen.queryByText(/aren't available here yet/)).not.toBeInTheDocument();
  });

  it("says why there's no Telegram link when the server has no bot, and offers the acknowledgment rule off", async () => {
    render(await AgentPage(params("customer")));
    expect(screen.getByText(/Telegram isn't set up on this server/)).toBeInTheDocument();
    expect(screen.getByText(/got your message and will reply soon/)).toBeInTheDocument();
  });

  it("shows the business's Telegram link and a QR code for it when the server has a bot", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "AnchoredDemoBot");
    try {
      render(await AgentPage(params("customer")));
      expect((screen.getByLabelText("Your business's test link") as HTMLInputElement).value).toMatch(/^https:\/\/t\.me\/AnchoredDemoBot\?start=/);
      expect(screen.getByRole("img", { name: "QR code for your business's Telegram link" })).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("shows Internal Communications' brief with Run now", async () => {
    render(await AgentPage(params("internal")));
    expect(screen.getByRole("button", { name: /run now/i })).toBeInTheDocument();
  });

  it("does not open another session's business", async () => {
    await stores.current?.saveBusiness("another-owner", { ...SHOP, id: "other-shop" });
    await expect(AgentPage(params("customer", "other-shop"))).rejects.toThrow("not-found");
  });

  it("does not turn a failed feed read into a 404 or a successful empty view", async () => {
    if (stores.current === null) throw new Error("Missing store");
    vi.spyOn(stores.current, "listCards").mockRejectedValue(new Error("Feed read failed"));
    await expect(AgentPage(params("customer"))).rejects.toThrow("Feed read failed");
  });

  it("does not turn a failed choices read into an inactive-agent 404", async () => {
    if (stores.current === null) throw new Error("Missing store");
    vi.spyOn(stores.current, "getChoices").mockRejectedValue(new Error("Choices read failed"));
    await expect(AgentPage(params("customer"))).rejects.toThrow("Choices read failed");
  });
});
