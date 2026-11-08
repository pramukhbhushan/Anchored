import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardRecord } from "@/lib/api/contract";
import { customerNames, draftFeed } from "@/lib/domain/cards";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { profileFromFacts } from "@/lib/domain/engine";
import { OPT_OUT_LINE } from "@/lib/domain/executor";
import { chosenSkills, resolveChoices } from "@/lib/domain/paths";
import type { BusinessProfile, SkillId } from "@/lib/domain/types";
import type { LlmProvider, ObjectRequest } from "@/lib/llm";
import { LlmResponseError } from "@/lib/llm";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// Starter drafts written for one business. The model, mocked at the
// `LlmProvider` boundary, writes only the words; code picks the skills, sets
// every other field, and swaps in the trade's template for any draft that
// breaks a send rule or when the call fails. Starters are written once.

const SESSION = "owner-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
const models = vi.hoisted(() => ({ current: null as LlmProvider | null }));
vi.mock("@/lib/server/ai-budget", () => ({ getBudgetedLlm: () => models.current }));

const { writeStarters } = await import("./starters");

/** One draft as the model writes it. */
interface WrittenDraft {
  readonly skill: string;
  readonly contact: string;
  readonly title: string;
  readonly body: string;
  readonly whyNow: string;
}

/** A model that records each prompt and answers with `reply(prompt)`. */
function modelWriting(reply: (prompt: string) => readonly WrittenDraft[]): LlmProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    generateText: async () => {
      throw new Error("Starters ask for an object, not text.");
    },
    generateObject: async <T,>(request: ObjectRequest<T>) => {
      prompts.push(request.prompt);
      return request.schema.parse({ starters: reply(request.prompt) });
    },
  } as unknown as LlmProvider & { prompts: string[] };
}

/** The customer names offered to the business a prompt is about, as the model would read them from it. */
function offeredNames(prompt: string): string[] {
  return customerNames(prompt.includes("Sugar Loaf") ? "b_bakery" : "b_plumber", 8);
}

/** A clean draft for every card skill, each to a different offered customer, whatever skills the prompt asked for. */
function draftsForEverySkill(text: (skill: string) => string, prompt: string): WrittenDraft[] {
  const people = offeredNames(prompt);
  const skills = ["callback", "inquiry", "showup", "catering", "closer", "callfollow", "reviewer", "referral", "nudger", "posts", "reviewdrafter", "reactivator", "keeper"];
  return skills.map((skill, i) => ({
    skill,
    contact: people[i % people.length] ?? "",
    title: `Written title for ${skill}`,
    body: text(skill),
    whyNow: "They asked this morning and are comparing options.",
  }));
}

function plumber(): BusinessProfile {
  return profileFromFacts({
    id: "b_plumber",
    name: "Greenbelt Plumbing",
    trade: "Plumber",
    tradeKey: "home",
    place: "Greenbelt, MD",
    customers: "Homeowners and landlords in Prince George's County",
    reach: ["Phone calls", "Website form", "Google"],
    tools: ["Housecall Pro", "QuickBooks Online"],
    signals: ["quotes"],
    tasks: ["Calling back after a job", "Chasing quotes for water heaters"],
    voice: "Hey, it's Luis from Greenbelt Plumbing, happy to help.",
  });
}

function bakery(): BusinessProfile {
  return profileFromFacts({
    id: "b_bakery",
    name: "Sugar Loaf Bakery",
    trade: "Bakery",
    tradeKey: "restaurant",
    place: "Frederick, MD",
    customers: "Neighbors, office lunch orders and wedding cakes",
    reach: ["Walk-ins", "Instagram or Facebook", "Phone calls"],
    tools: ["Square"],
    signals: ["catering"],
    tasks: ["Answering cake order DMs", "Posting the daily bake"],
    voice: "Hi friend! Thanks for the sweet note.",
  });
}

async function storedCards(business: BusinessProfile): Promise<CardRecord[]> {
  return stores.current!.listCards(SESSION, business.id);
}

/** The template card the feed shows for `skill` before anything is written. */
function templateFor(business: BusinessProfile, skill: SkillId) {
  const card = draftFeed(business, resolveChoices(business, {})).find((draft) => draft.skill === skill);
  if (card === undefined) throw new Error(`test setup: no template card for ${skill}`);
  return card;
}

beforeEach(async () => {
  stores.current = new MemoryStore();
  models.current = null;
  for (const business of [plumber(), bakery()]) await stores.current.saveBusiness(SESSION, business);
});

describe("written starters", () => {
  it("are written from the owner's own profile", async () => {
    const model = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt));
    models.current = model;

    await writeStarters(SESSION, plumber());
    await writeStarters(SESSION, bakery());

    const [plumberPrompt, bakeryPrompt] = model.prompts;
    expect(plumberPrompt).toContain("Chasing quotes for water heaters");
    expect(plumberPrompt).toContain("Hey, it's Luis from Greenbelt Plumbing");
    expect(plumberPrompt).toContain("Homeowners and landlords");
    expect(plumberPrompt).toContain("Greenbelt, MD");
    expect(plumberPrompt).not.toContain("Sugar Loaf");
    expect(bakeryPrompt).toContain("Answering cake order DMs");
    expect(bakeryPrompt).toContain("Frederick, MD");
  });

  it("go only to skills the plan turns on, three or four of them", async () => {
    models.current = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt));
    const business = plumber();

    await writeStarters(SESSION, business);

    const written = (await storedCards(business)).filter((card) => card.title.startsWith("Written title"));
    const chosen = chosenSkills(business, resolveChoices(business, {}));
    expect(written.length).toBeGreaterThanOrEqual(3);
    expect(written.length).toBeLessThanOrEqual(4);
    for (const card of written) expect(chosen, card.title).toContain(card.skill);
    expect(written.map((card) => card.skill)).not.toContain("catering");
  });

  it("skip a skill the owner switched off", async () => {
    models.current = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt));
    const business = plumber();
    await stores.current!.setChoice(SESSION, business.id, "leads", { path: "skip" });

    await writeStarters(SESSION, business);

    expect((await storedCards(business)).map((card) => card.skill)).not.toContain("inquiry");
  });

  it("keep the fields code decides and mark each one an example", async () => {
    models.current = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt));
    const business = plumber();

    await writeStarters(SESSION, business);

    const inquiry = (await storedCards(business)).find((card) => card.skill === "inquiry");
    const template = templateFor(business, "inquiry");
    expect(inquiry).toMatchObject({
      example: true,
      key: template.key,
      channel: template.channel,
      action: template.action,
      agent: template.agent,
      title: "Written title for inquiry",
      reason: "They asked this morning and are comparing options.",
      body: "Thanks for reaching out, we can help.",
    });
    expect(inquiry?.to).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    // The plumber keeps a calendar, so the template offers times; a written starter names none, so it claims no match.
    expect(template.checks).toContain("Times match your calendar");
    expect(inquiry?.checks).toEqual(template.checks.filter((check) => check !== "Times match your calendar"));
  });

  it("end every text with the opt-out line", async () => {
    models.current = modelWriting((prompt) => draftsForEverySkill(() => "Sorry we missed your call, want us to ring you back?", prompt));
    const business = plumber();

    await writeStarters(SESSION, business);

    const texts = (await storedCards(business)).filter((card) => card.channel === "sms");
    expect(texts.length).toBeGreaterThan(0);
    for (const card of texts) expect(card.body.endsWith(OPT_OUT_LINE), card.skill ?? "").toBe(true);
  });

  it("give different businesses different starters", async () => {
    models.current = modelWriting((prompt) => draftsForEverySkill(() => (prompt.includes("Bakery") ? "Fresh loaves are ready, want one set aside?" : "We can come take a look at that leak."), prompt));

    await writeStarters(SESSION, plumber());
    await writeStarters(SESSION, bakery());

    const plumberBodies = (await storedCards(plumber())).map((card) => card.body);
    const bakeryBodies = (await storedCards(bakery())).map((card) => card.body);
    expect(plumberBodies.filter((body) => bakeryBodies.includes(body))).toEqual([]);
    expect(plumberBodies.join(" ")).toContain("leak");
    expect(bakeryBodies.join(" ")).toContain("loaves");
    const customers = async (business: BusinessProfile) => (await storedCards(business)).flatMap((card) => (card.to === undefined ? [] : [card.to]));
    const bakeryCustomers = await customers(bakery());
    expect((await customers(plumber())).filter((name) => bakeryCustomers.includes(name))).toEqual([]);
  });
});

describe("a draft that breaks a rule", () => {
  it.each([
    ["a price", "We can do it for $99 if you book today."],
    ["a phone number", "Call us back at (301) 555-0199 anytime."],
    ["a link", "Pay at https://pay.example.com to lock it in."],
    ["a number the profile never gave", "We have 3 openings left."],
    ["a blank to fill", "Thanks! Book a time at [your booking link]."],
    ["allergy talk", "Our kitchen is peanut free, so no worries."],
  ])("with %s is replaced by the trade's template, and clean drafts stay", async (_label, body) => {
    models.current = modelWriting((prompt) => draftsForEverySkill((skill) => (skill === "inquiry" ? body : "Thanks for reaching out, we can help."), prompt));
    const business = plumber();

    await writeStarters(SESSION, business);

    const cards = await storedCards(business);
    expect(cards.find((card) => card.skill === "inquiry")?.body).toBe(templateFor(business, "inquiry").body);
    expect(cards.some((card) => card.title.startsWith("Written title"))).toBe(true);
  });

  it("is replaced when it reuses another draft's customer", async () => {
    const first = customerNames("b_plumber", 1)[0];
    models.current = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt).map((draft) => ({ ...draft, contact: first ?? "" })));
    const business = plumber();

    await writeStarters(SESSION, business);

    expect((await storedCards(business)).filter((card) => card.to === first)).toHaveLength(1);
  });

  it.each([
    ["a stock name it wasn't offered", "Sarah Johnson"],
    ["anything but a name", "Customer 1"],
  ])("is replaced when the customer is %s", async (_label, contact) => {
    models.current = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt).map((draft) => ({ ...draft, contact })));
    const business = plumber();

    await writeStarters(SESSION, business);

    expect((await storedCards(business)).some((card) => card.title.startsWith("Written title"))).toBe(false);
  });
});

describe("falling back", () => {
  it("stores the trade's templates when the model call fails, and doesn't try again", async () => {
    let calls = 0;
    models.current = {
      generateText: async () => "",
      generateObject: async () => {
        calls += 1;
        throw new LlmResponseError("The model's reply wasn't valid JSON.");
      },
    } as unknown as LlmProvider;
    const business = plumber();

    await writeStarters(SESSION, business);
    await writeStarters(SESSION, business);

    expect(calls).toBe(1);
    const cards = await storedCards(business);
    expect(cards.length).toBeGreaterThanOrEqual(3);
    for (const card of cards) {
      expect(card.example).toBe(true);
      expect(card.body).toBe(templateFor(business, card.skill as SkillId).body);
    }
  });

  it("writes nothing with AI off, so the page keeps showing the templates", async () => {
    await writeStarters(SESSION, plumber());

    expect(await storedCards(plumber())).toEqual([]);
  });
});

describe("writing once", () => {
  it("asks the model once per business", async () => {
    const model = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt));
    models.current = model;

    await writeStarters(SESSION, plumber());
    await writeStarters(SESSION, plumber());

    expect(model.prompts).toHaveLength(1);
  });

  it("never writes over the example business's researched cards", async () => {
    const model = modelWriting((prompt) => draftsForEverySkill(() => "Thanks for reaching out, we can help.", prompt));
    models.current = model;

    await writeStarters(SESSION, SAMPLE_BUSINESS);

    expect(model.prompts).toHaveLength(0);
    expect(await storedCards(SAMPLE_BUSINESS)).toEqual([]);
  });
});
