import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { OPT_OUT_LINE } from "@/lib/domain/executor";
import { POST_BRIEF_QUESTION } from "@/lib/domain/posts";
import { chatCardKey } from "@/lib/domain/requests";
import type { LlmProvider } from "@/lib/llm";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The example business's chat, as a visitor reads it: the first message says
// what chat does in an owner's own business and that the example can't
// change, and a message sent to it changes and stores nothing. An owner's own
// chat drafts the work they ask for into Approvals, and links the reply to the
// card. The model, when a test sets one, writes only the words.

const SESSION = "visitor-session";

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));
const models = vi.hoisted(() => ({ current: null as LlmProvider | null }));
vi.mock("@/lib/server/ai-budget", () => ({ getBudgetedLlm: () => models.current }));

const { askInChat, listBusinessChat, sendBusinessChat } = await import("./business-chat");
const { setAutomation } = await import("./automations");

beforeEach(() => {
  stores.current = new MemoryStore();
  models.current = null;
});

/** A model that answers every text request with `reply`. */
function modelSaying(reply: string): LlmProvider {
  return {
    generateText: async () => reply,
    generateObject: async () => {
      throw new Error("This test's model only writes text.");
    },
  } as unknown as LlmProvider;
}

/** A model that reads every chat message as changing only the text fields in `texts`. */
function modelReading(texts: { kind: string | null; name: string | null; place: string | null; voice: string | null }): LlmProvider {
  const none = { reach: [], tools: [], signals: [], languages: [] };
  return {
    generateText: async () => {
      throw new Error("This test's model only reads changes.");
    },
    generateObject: async () => ({ add: none, remove: none, ...texts }),
  } as unknown as LlmProvider;
}

describe("the example business's chat", () => {
  it("opens by saying what chat does for an owner and that the example can't change", async () => {
    const { messages } = await listBusinessChat(SESSION, SAMPLE_BUSINESS);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("tell Anchored what changed");
    expect(messages[0]?.text).toContain("can't change anything");
    expect(messages[0]?.text).toContain("You can chat");
  });

  it("keeps a visitor conversation without changing the shared example", async () => {
    const sent = await sendBusinessChat(SESSION, SAMPLE_BUSINESS, "We now take EBT");

    expect(sent.changes).toEqual([]);
    expect(sent.messages.at(-1)?.text).toContain("example can't change or send messages");
    expect((await listBusinessChat(SESSION, SAMPLE_BUSINESS)).messages).toHaveLength(3);
    expect(await stores.current!.listCards(SESSION, SAMPLE_BUSINESS.id)).toHaveLength(0);
    expect((await listBusinessChat("another-visitor", SAMPLE_BUSINESS)).messages).toHaveLength(1);
  });
});

describe("an owner's own chat", () => {
  const shop = hvacShop();

  it("drafts the work the owner asks for into Approvals and links the reply to the card", async () => {
    const sent = await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const reply = sent.messages.at(-1);
    expect(reply?.text).toContain("drafted a text to Dana");
    const cards = await stores.current!.listCards(SESSION, shop.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ status: "pending", channel: "sms", to: "Dana", key: chatCardKey(shop.id, reply!.id) });
    expect(cards[0]?.body).toBe(`Hi Dana, it's College Park Heating & Air. We're running 20 minutes late. ${OPT_OUT_LINE}`);
    expect(reply?.card).toEqual({ key: cards[0]?.key, title: "Text Dana we're running 20 minutes late", status: "pending" });
  });

  it("keeps the link on the reply after a reload", async () => {
    await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const { messages } = await listBusinessChat(SESSION, shop);

    expect(messages.at(-1)?.card?.status).toBe("pending");
    expect(messages.filter((message) => message.card !== undefined)).toHaveLength(1);
  });

  it("names the workflow to Build when none of the owner's agents does the work, and drafts nothing", async () => {
    await stores.current!.setChoice(SESSION, shop.id, "social", { path: "skip" });

    const sent = await sendBusinessChat(SESSION, shop, "write a post about our new heat pump service");

    expect(sent.messages.at(-1)?.text).toContain(`"Social posts and marketing"`);
    expect(await stores.current!.listCards(SESSION, shop.id)).toEqual([]);
  });

  it("still updates the profile when the owner says what changed", async () => {
    const sent = await sendBusinessChat(SESSION, shop, "We started doing catering");

    expect(sent.changes.length).toBeGreaterThan(0);
    expect(await stores.current!.listCards(SESSION, shop.id)).toEqual([]);
  });

  it("uses the model's words when they add nothing the owner didn't say", async () => {
    models.current = modelSaying("Hi Dana, sorry, we're running 20 minutes late. See you soon!");

    await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const [card] = await stores.current!.listCards(SESSION, shop.id);
    expect(card?.body).toBe(`Hi Dana, sorry, we're running 20 minutes late. See you soon! ${OPT_OUT_LINE}`);
  });

  it("changes nothing when the model reads a change into a question", async () => {
    models.current = modelReading({ kind: "Plumbing", name: null, place: null, voice: null });

    const sent = await sendBusinessChat(SESSION, shop, "What did you send to my customers today?");

    expect(sent.changes).toEqual([]);
    expect(sent.messages.at(-1)?.text).not.toContain("Updated your profile");
  });

  it("keeps a change the owner's own words state", async () => {
    models.current = modelReading({ kind: "Plumbing and heating", name: null, place: null, voice: null });

    const sent = await sendBusinessChat(SESSION, shop, "We do plumbing and heating now");

    expect(sent.changes).toContainEqual(expect.objectContaining({ area: "kind", label: "Plumbing and heating" }));
  });

  it("falls back to the rules when the model adds a price", async () => {
    models.current = modelSaying("Hi Dana, we're running 20 minutes late, so today's visit is $20 off.");

    await sendBusinessChat(SESSION, shop, "text Dana we're running 20 minutes late");

    const [card] = await stores.current!.listCards(SESSION, shop.id);
    expect(card?.body).not.toContain("$20");
    expect(card?.body).toContain("We're running 20 minutes late.");
  });
});

describe("the example business's chat, asked for work", () => {
  it("drafts and stores nothing", async () => {
    const sent = await sendBusinessChat(SESSION, SAMPLE_BUSINESS, "write a post about our new Taco Tuesday");

    expect(sent.messages.at(-1)?.card).toBeUndefined();
    expect(await stores.current!.listCards(SESSION, SAMPLE_BUSINESS.id)).toEqual([]);
  });
});

describe("Bookkeeping in an owner's chat", () => {
  const shop = hvacShop();
  const store = () => stores.current!;
  const say = (text: string) => sendBusinessChat(SESSION, shop, text);
  const reminders = async () => (await store().listCards(SESSION, shop.id)).filter((card) => card.skill === "nudger" && card.invoice);

  beforeEach(async () => {
    await store().setChoice(SESSION, shop.id, "books", { path: "build", skills: ["nudger"] });
  });

  it("drafts a reminder from what the owner typed and links the reply to it", async () => {
    await store().saveContact(SESSION, { businessId: shop.id, name: "Maya Chen", phone: null, email: "maya.chen@example.com", consent: null, optedOutAt: null });

    const sent = await say("Maya Chen owes $450 on invoice 1042, due Oct 20");

    const reply = sent.messages.at(-1);
    expect(reply?.text).toBe("Bookkeeping and Invoicing drafted a reminder to Maya Chen for $450 on invoice 1042. It's waiting in Approvals.");
    const [card] = await reminders();
    expect(card).toMatchObject({ key: chatCardKey(shop.id, reply!.id), to: "maya.chen@example.com", stake: 450, invoice: { key: "n:1042" } });
    expect(card?.body).toContain("for $450 was due Oct 20");
    expect(reply?.card).toEqual({ key: card?.key, title: "Maya Chen owes $450 on invoice 1042", status: "pending" });
  });

  it("says how to send it when the customer has no email on file", async () => {
    const sent = await say("Jordan Ellis owes $1,200 on invoice 1043");
    expect(sent.messages.at(-1)?.text).toContain("Add Jordan Ellis's email in Connections so Anchored can send it, or send it yourself.");
    expect((await reminders())[0]).toMatchObject({ to: "Jordan Ellis", stake: 1200 });
  });

  it("asks for a missing amount and drafts nothing", async () => {
    const sent = await say("Jordan still owes me");
    expect(sent.messages.at(-1)?.text).toBe("How much does Jordan owe? I'll only use the amount you give me.");
    expect(await store().listCards(SESSION, shop.id)).toEqual([]);
  });

  it("refuses a third reminder in the owner's words", async () => {
    await say("Maya Chen owes $450 on invoice 1042");
    await say("Maya Chen owes $450 on invoice 1042");
    const sent = await say("Maya Chen owes $450 on invoice 1042");
    expect(sent.messages.at(-1)?.text).toBe("Invoice 1042 already has 2 reminders. Anchored won't send a third. Call the customer if it's still unpaid.");
    expect(await reminders()).toHaveLength(2);
  });

  it("says so when another reminder lands between the check and the draft", async () => {
    const memory = store();
    const addMessages = memory.addMessages.bind(memory);
    // Two reminders for the same invoice arrive while the chat stores its reply, so the draft hits the cap.
    vi.spyOn(memory, "addMessages").mockImplementationOnce(async (...args) => {
      const saved = await addMessages(...args);
      const invoice = { key: "n:1042", amount: 450, number: "1042" };
      const reminder = { agent: null, skill: "nudger" as const, title: "Reminder", body: "", reason: "", checks: [], action: "Send email", channel: "email" as const, invoice };
      await memory.ensureCards(SESSION, shop.id, [{ ...reminder, key: "other-1" }, { ...reminder, key: "other-2" }]);
      return saved;
    });

    const sent = await say("Maya Chen owes $450 on invoice 1042");

    expect(sent.messages.at(-1)?.text).toBe("That reminder wasn't drafted after all. Invoice 1042 already has 2 reminders. Anchored won't send a third. Call the customer if it's still unpaid.");
    expect(sent.messages.some((message) => message.card !== undefined)).toBe(false);
  });

  it("marks an invoice paid and says how many reminders it stopped", async () => {
    await say("Maya Chen owes $450 on invoice 1042");
    const sent = await say("Maya paid 1042");
    expect(sent.messages.at(-1)?.text).toBe("Marked invoice 1042 from Maya paid. I stopped 1 reminder that was waiting.");
    expect((await reminders())[0]?.status).toBe("superseded");
  });

  it("asks which invoice when a customer with two open ones paid", async () => {
    await say("Maya Chen owes $450 on invoice 1042");
    await say("Maya Chen owes $90 on invoice 1046");
    const sent = await say("Maya Chen paid in full");
    expect(sent.messages.at(-1)?.text).toBe("Maya Chen has more than one open invoice: invoice 1042 and invoice 1046. Which one was paid?");
    expect((await reminders()).every((card) => card.status === "pending")).toBe(true);
  });

  it("leaves money the business itself paid to the profile reader", async () => {
    const sent = await say("We paid $300 for new ads last month");
    expect(sent.messages.at(-1)?.text).not.toMatch(/Which invoice|reminder/);
    expect(await store().listCards(SESSION, shop.id)).toEqual([]);
  });

  it("leaves invoice talk to the request reader when Bookkeeping isn't working", async () => {
    await store().setChoice(SESSION, shop.id, "books", { path: "skip" });
    await say("Maya Chen owes $450 on invoice 1042");
    expect(await reminders()).toEqual([]);
  });
});

describe("photo posts in chat", () => {
  const shop = hvacShop();
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  /** Turn on post drafts and upload `count` photos, returning their ids. */
  async function setUp(count: number): Promise<string[]> {
    await stores.current!.setChoice(SESSION, shop.id, "social", { path: "build", skills: ["posts"] });
    const photos = [];
    for (let i = 0; i < count; i++) photos.push((await stores.current!.savePhoto(SESSION, shop.id, JPEG, "image/jpeg")).id);
    return photos;
  }

  it("drafts a post card with the photos and a caption per platform, and links the reply to it", async () => {
    const photos = await setUp(3);
    const sent = await sendBusinessChat(SESSION, shop, "Before and after of a furnace replacement", undefined, photos);

    const reply = sent.messages.at(-1);
    expect(reply?.text).toContain('drafted a "Before and after" post from your 3 photos');
    const [card] = await stores.current!.listCards(SESSION, shop.id);
    expect(card).toMatchObject({ skill: "posts", channel: "list", action: "Copy post", title: "Post: Before and after of a furnace replacement", key: chatCardKey(shop.id, reply!.id) });
    expect(card?.post?.photos.map((p) => p.id)).toEqual(photos);
    expect(card?.post?.photos[0]?.url).toBe(`/api/businesses/${shop.id}/photos/${photos[0]}`);
    expect(Object.keys(card?.post?.captions ?? {})).toEqual(["instagram", "facebook", "linkedin"]);
    expect(card?.body).toBe(card?.post?.captions.instagram);
    expect(reply?.card?.key).toBe(card?.key);
  });

  it("drafts no post when post drafts are off", async () => {
    const photos = await setUp(1);
    await stores.current!.setChoice(SESSION, shop.id, "social", { path: "skip" });
    const sent = await sendBusinessChat(SESSION, shop, "New furnace", undefined, photos);
    expect(sent.messages.at(-1)?.text).toContain("post drafts are off for College Park Heating & Air. Turn on \"Social posts and marketing\" on the Automations page");
    expect(sent.keepComposer).toBe(true);
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(0);
  });

  it("refuses photos that aren't this business's own", async () => {
    await setUp(0);
    const other = await stores.current!.savePhoto("another-session", shop.id, JPEG, "image/jpeg");
    const sent = await sendBusinessChat(SESSION, shop, "New furnace", undefined, [other.id]);
    expect(sent.messages.at(-1)?.text).toContain("couldn't find one of those photos");
    expect(sent.keepComposer).toBe(true);
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(0);
  });

  it("stops at 10 posts a day and calls no model for the 11th", async () => {
    const photos = await setUp(1);
    for (let i = 0; i < 10; i++) await sendBusinessChat(SESSION, shop, `Job number ${i}`, undefined, photos);
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(10);

    const generateObject = vi.fn();
    models.current = { generateText: vi.fn(), generateObject } as unknown as LlmProvider;
    const sent = await sendBusinessChat(SESSION, shop, "One more", undefined, photos);
    expect(sent.messages.at(-1)?.text).toContain("You've made 10 photo posts in the last day");
    expect(generateObject).not.toHaveBeenCalled();
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(10);
  });
});

describe("asking for posts and marketing help in chat", () => {
  const shop = hvacShop();
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const ASK = "Marketing is our top priority. Can you help turn our classroom event photos into social posts?";

  async function postsOn(on: boolean): Promise<void> {
    await stores.current!.setChoice(SESSION, shop.id, "social", on ? { path: "build", skills: ["posts"] } : { path: "skip" });
  }

  it("answers with the post question, and leaves the profile alone even when the model reads a change", async () => {
    await postsOn(true);
    models.current = modelReading({ kind: "Café", name: null, place: null, voice: null });
    const sent = await sendBusinessChat(SESSION, shop, ASK);
    expect(sent.messages.at(-1)?.text).toContain(POST_BRIEF_QUESTION);
    expect(sent.changes).toEqual([]);
  });

  it.each(["please help us make a carousel", "We have a marketing problem"])("treats %j as a post request", async (text) => {
    await postsOn(true);
    expect((await sendBusinessChat(SESSION, shop, text)).messages.at(-1)?.text).toContain(POST_BRIEF_QUESTION);
  });

  it("says how to turn post drafts on when they're off", async () => {
    await postsOn(false);
    const sent = await sendBusinessChat(SESSION, shop, ASK);
    expect(sent.messages.at(-1)?.text).toContain('Turn on "Social posts and marketing" on the Automations page');
  });

  it("still drafts a text post the owner asks for by name", async () => {
    await postsOn(true);
    const sent = await sendBusinessChat(SESSION, shop, "Write a post about this week's special");
    expect(sent.messages.at(-1)?.card).toBeDefined();
  });

  it("asks for the photos when the owner answers the post question without them, and keeps their words", async () => {
    await postsOn(true);
    await sendBusinessChat(SESSION, shop, ASK);
    const sent = await sendBusinessChat(SESSION, shop, "Our weekend workshop, where students built solar heaters");
    expect(sent.messages.at(-1)?.text).toContain("add the photos for this post");
    expect(sent.keepComposer).toBe(true);
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(0);
  });

  it("asks the post question when the photos come with only instructions, and keeps them to resend", async () => {
    await postsOn(true);
    const photo = await stores.current!.savePhoto(SESSION, shop.id, JPEG, "image/jpeg");
    const sent = await sendBusinessChat(SESSION, shop, "Draft only. Use a warm tone.", undefined, [photo.id]);
    expect(sent.messages.at(-1)?.text).toContain(POST_BRIEF_QUESTION);
    expect(sent.keepComposer).toBe(true);
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(0);
  });

  it("drafts from a brief that mixes facts with instructions, keeping the instructions out of the captions", async () => {
    await postsOn(true);
    const photo = await stores.current!.savePhoto(SESSION, shop.id, JPEG, "image/jpeg");
    const sent = await sendBusinessChat(SESSION, shop, "Marketing test: a recap of our classroom event. The photos show a projected presentation. Draft only.", undefined, [photo.id]);
    expect(sent.keepComposer).toBeUndefined();
    const [card] = await stores.current!.listCards(SESSION, shop.id);
    expect(card?.post?.captions.instagram).toContain("A projected presentation.");
    expect(card?.post?.captions.instagram).not.toMatch(/Draft only|Marketing test/);
  });
});

describe("turning an automation on or off", () => {
  const shop = hvacShop();

  it("turns post drafts on and asks the post question in chat, after the welcome line", async () => {
    await stores.current!.saveBusiness(SESSION, shop, "chat");
    const result = await setAutomation(SESSION, shop, "social", true);
    expect(result).toEqual({ choice: { path: "build", skills: expect.arrayContaining(["posts"]) }, asked: true });
    const { messages } = await listBusinessChat(SESSION, shop);
    expect(messages).toHaveLength(2);
    expect(messages[1]?.text).toBe(`Social posts and marketing is on. Want to make a post now? ${POST_BRIEF_QUESTION} Add your photos with the photo button next to the text box and send them with your intro.`);
  });

  it("turns a job off, so nobody handles it, and asks nothing", async () => {
    const result = await setAutomation(SESSION, shop, "social", false);
    expect(result).toEqual({ choice: { path: "skip" }, asked: false });
    expect((await listBusinessChat(SESSION, shop)).messages.every((m) => !m.text.includes("is on."))).toBe(true);
  });

  it("puts a question in an existing thread without repeating the welcome line", async () => {
    await askInChat(SESSION, shop, "First");
    await askInChat(SESSION, shop, "Second");
    expect((await listBusinessChat(SESSION, shop)).messages.map((m) => m.text).slice(-2)).toEqual(["First", "Second"]);
  });
});

describe("agent-scoped conversations", () => {
  const shop = hvacShop();
  it("keeps Customer, Internal and general histories separate", async () => {
    await sendBusinessChat(SESSION, shop, "What should I focus on?", "customer");
    const customer = await listBusinessChat(SESSION, shop, "customer");
    const internal = await listBusinessChat(SESSION, shop, "internal");
    const general = await listBusinessChat(SESSION, shop);
    expect(customer.messages.some((m) => m.role === "owner")).toBe(true);
    expect(internal.messages.some((m) => m.role === "owner")).toBe(false);
    expect(general.messages.some((m) => m.role === "owner")).toBe(false);
  });
  it("rejects an inactive agent before storing anything", async () => {
    await stores.current!.setChoice(SESSION, shop.id, "social", { path: "skip" });
    await expect(sendBusinessChat(SESSION, shop, "Hello", "content")).rejects.toThrow("not active");
  });
  it("cannot draft another agent's work from Customer chat", async () => {
    await stores.current!.setChoice(SESSION, shop.id, "social", { path: "build", skills: ["posts"] });
    await sendBusinessChat(SESSION, shop, "write a post about spring", "customer");
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(0);
  });
  it("uses the budgeted model for a conversational reply with the selected role and history", async () => {
    const generateText = vi.fn(async () => "Start by checking the inquiries waiting for you. Which needs a reply?");
    models.current = { ...modelSaying(""), generateText };
    const reply = await sendBusinessChat(SESSION, shop, "What should I focus on?", "customer");
    expect(reply.messages.at(-1)?.text).toContain("Which needs a reply?");
    expect(generateText.mock.calls[0]).toBeDefined();
    expect(JSON.stringify(generateText.mock.calls)).toContain("You are Customer");
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(0);
  });
  it("does not present an invented model action as a completed action", async () => {
    models.current = modelSaying("I sent the customer a message.");
    const reply = await sendBusinessChat(SESSION, shop, "What should I focus on?", "customer");
    expect(reply.messages.at(-1)?.text).toContain("couldn't produce a reliable AI reply");
    expect(await stores.current!.listCards(SESSION, shop.id)).toHaveLength(0);
  });
});


it("answers example questions with AI without applying an action request", async () => {
  models.current = modelSaying("The Customer agent prepares replies for your approval. What would you like to explore?");
  const result = await sendBusinessChat(SESSION, SAMPLE_BUSINESS, "Send a customer a reminder", "customer");
  expect(result.messages.at(-1)?.text).toContain("What would you like to explore?");
  expect(result.changes).toEqual([]);
  expect(await stores.current!.listCards(SESSION, SAMPLE_BUSINESS.id)).toHaveLength(0);
  expect((await listBusinessChat("another-visitor", SAMPLE_BUSINESS, "customer")).messages).toHaveLength(1);
});
