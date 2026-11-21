import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeResponse } from "@/lib/api/contract";
import type { IntakeAnswer } from "@/lib/domain/intake";
import { MemoryStore } from "@/lib/store/memory";

// =============================================================================
// Module Overview
// =============================================================================
// The onboarding chat's store flows on the in-memory store, read by the rules: a new
// chat opens with a question, a reload reads it back only for its own session,
// each answer adds the owner's words and Anchored's reply, and the owner's yes
// at the review builds one business, after which a repeated tap builds no
// second one.

const SESSION = "owner-session";

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, scheduleStarters: vi.fn() }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/starters", () => ({ scheduleStarters: state.scheduleStarters }));

const { answerIntake, readIntake, startIntake } = await import("./intake");

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

/** Answer, failing the test when the chat is gone. */
async function reply(id: string, answer: IntakeAnswer): Promise<IntakeResponse> {
  const next = await answerIntake(SESSION, id, answer);
  if (next === null) throw new Error("the onboarding chat was not found");
  return next;
}

const SCRIPT: readonly IntakeAnswer[] = [
  { text: "Greenfield Lawn & Landscape, Bowie, MD" },
  { picks: ["Home services"] },
  { text: "Weekly mowing at $45 a visit and spring cleanups around $350, mostly homeowners" },
  { picks: ["Phone calls", "Referrals", "Google"] },
  { picks: ["QuickBooks Online"] },
  { picks: ["quotes", "memberships"] },
  { picks: ["English", "Spanish"] },
  { text: "Writing up quotes at night, calling people back" },
  { text: "Hey! Thanks for reaching out. I can swing by Thursday." },
];

/** Answer the planned questions, skip the gaps, and stop at the review. */
async function throughToReview(id: string): Promise<IntakeResponse> {
  let current: IntakeResponse | null = null;
  for (const answer of SCRIPT) current = await reply(id, answer);
  while (current?.question && current.question.field !== "confirm") {
    current = await reply(id, current.question.field.startsWith("gap:") ? { text: "skip" } : { picks: ["yes"] });
  }
  if (current === null) throw new Error("the script asked nothing");
  return current;
}

beforeEach(() => {
  state.store = new MemoryStore();
  state.scheduleStarters.mockClear();
});

describe("startIntake", () => {
  it("saves an empty chat with Anchored's greeting and asks for the name first", async () => {
    const started = await startIntake(SESSION);
    expect(started.intakeId).toMatch(/^i_[0-9a-f-]{36}$/);
    expect(started.question?.field).toBe("name");
    expect(started.done).toBe(false);
    expect(started.messages.length).toBeGreaterThan(0);
    expect(started.messages.every((message) => message.role === "anchored")).toBe(true);
  });
});

describe("readIntake", () => {
  it("reads a chat back for its own session only", async () => {
    const { intakeId, messages } = await startIntake(SESSION);
    expect((await readIntake(SESSION, intakeId))?.messages).toEqual(messages);
    expect(await readIntake("someone-else", intakeId)).toBeNull();
  });
});

describe("answerIntake", () => {
  it("returns null for a chat the session doesn't have", async () => {
    const { intakeId } = await startIntake(SESSION);
    expect(await answerIntake("someone-else", intakeId, { text: "Hi" })).toBeNull();
  });

  it("adds the owner's answer and Anchored's reply, then asks the next question", async () => {
    const { intakeId, messages } = await startIntake(SESSION);
    const next = await reply(intakeId, { text: "Greenfield Lawn & Landscape, Bowie, MD" });
    expect(next.messages).toHaveLength(messages.length + 2);
    expect(next.messages.at(-2)).toMatchObject({ role: "owner", text: "Greenfield Lawn & Landscape, Bowie, MD" });
    expect(next.messages.at(-1)?.role).toBe("anchored");
    expect(next.question?.field).toBe("kind");
  });

  it("builds one business at the owner's yes and none on a repeated tap", async () => {
    const { intakeId } = await startIntake(SESSION);
    expect((await throughToReview(intakeId)).question?.field).toBe("confirm");

    const done = await reply(intakeId, { picks: ["yes"] });
    expect(done.done).toBe(true);
    expect(done.question).toBeNull();
    const businesses = await store().listBusinesses(SESSION);
    expect(businesses).toHaveLength(1);
    expect(done.businessId).toBe(businesses[0]?.id);
    expect(state.scheduleStarters).toHaveBeenCalledTimes(1);

    const again = await reply(intakeId, { picks: ["yes"] });
    expect(again).toEqual(done);
    expect(await store().listBusinesses(SESSION)).toHaveLength(1);
    expect(state.scheduleStarters).toHaveBeenCalledTimes(1);
  });
});
