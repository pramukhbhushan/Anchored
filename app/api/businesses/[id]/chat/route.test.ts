import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";
import { GET, POST } from "./route";

// =============================================================================
// Module Overview
// =============================================================================
// Agent chat routes validate both route tokens and actual active membership,
// and keep separate histories behind the session-derived business lookup.

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", async () => ({ NotFoundError: (await import("@/lib/store/types")).NotFoundError, getStore: () => stores.current }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => "owner" }));
vi.mock("@/lib/server/business-llm", () => ({ getBusinessLlm: () => null }));
const context = { params: Promise.resolve({ id: "hvac" }) };
beforeEach(async () => { stores.current = new MemoryStore(); await stores.current.saveBusiness("owner", hvacShop()); });

describe("agent chat route", () => {
  it("loads a separate history through the validated agent query", async () => {
    const response = await POST(new Request("http://localhost/api/businesses/hvac/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "What can you help me with?", agent: "customer" }) }), context);
    expect(response.status).toBe(200);
    const customer = await GET(new Request("http://localhost/api/businesses/hvac/chat?agent=customer"), context);
    const general = await GET(new Request("http://localhost/api/businesses/hvac/chat"), context);
    expect((await customer.json()).messages.some((m: { role: string }) => m.role === "owner")).toBe(true);
    expect((await general.json()).messages.some((m: { role: string }) => m.role === "owner")).toBe(false);
  });
  it("rejects malformed agent identifiers instead of ignoring them", async () => {
    const response = await POST(new Request("http://localhost/api/businesses/hvac/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Hello", agent: "admin" }) }), context);
    expect(response.status).toBe(400);
    expect((await GET(new Request("http://localhost/api/businesses/hvac/chat?agent=admin"), context)).status).toBe(400);
  });
  it("rejects a valid route token when that agent is inactive", async () => {
    await stores.current!.setChoice("owner", "hvac", "social", { path: "skip" });
    expect((await GET(new Request("http://localhost/api/businesses/hvac/chat?agent=content"), context)).status).toBe(404);
  });
  it("does not allow another session to read the business's chat", async () => {
    await stores.current!.reset("owner");
    await stores.current!.saveBusiness("other-owner", hvacShop());
    expect((await GET(new Request("http://localhost/api/businesses/hvac/chat?agent=customer"), context)).status).toBe(404);
  });
});
