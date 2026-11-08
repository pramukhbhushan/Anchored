import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// The example business's chat, as a visitor reads it: the first message says
// what chat does in an owner's own business and that the example can't
// change, and a message sent to it changes and stores nothing. No AI provider
// is set, so nothing here calls a model.

const SESSION = "visitor-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));

const { listBusinessChat, sendBusinessChat } = await import("./business-chat");

beforeEach(() => {
  stores.current = new MemoryStore();
});

describe("the example business's chat", () => {
  it("opens by saying what chat does for an owner and that the example can't change", async () => {
    const { messages } = await listBusinessChat(SESSION, SAMPLE_BUSINESS);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("tell Anchored what changed");
    expect(messages[0]?.text).toContain("can't change anything");
    expect(messages[0]?.text).toContain("Set up your business");
  });

  it("answers a message without changing or saving anything", async () => {
    const sent = await sendBusinessChat(SESSION, SAMPLE_BUSINESS, "We now take EBT");

    expect(sent.changes).toEqual([]);
    expect(sent.messages.at(-1)?.text).toContain("is an example, so I can't change it");
    expect((await listBusinessChat(SESSION, SAMPLE_BUSINESS)).messages).toHaveLength(1);
  });
});
