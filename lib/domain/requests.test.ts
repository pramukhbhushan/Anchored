import { describe, expect, it } from "vitest";
import { checkSend, OPT_OUT_LINE, QUIET_HOURS_RULE } from "@/lib/domain/executor";
import { chosenSkills, resolveChoices } from "@/lib/domain/paths";
import {
  askExample,
  chatCardKey,
  declineReply,
  draftedReply,
  readRequest,
  requestCard,
  ruleWords,
  type AskableSkill,
  type ChatRequest,
  type DraftRequest,
} from "@/lib/domain/requests";
import type { SkillId } from "@/lib/domain/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// How code reads an owner's chat message for work: what counts as a request,
// which chosen skill drafts it, what the card says, the words the rules write
// with no model, and what Anchored replies when no agent does the work.

const HVAC = hvacShop();
const NOON = new Date("2026-11-09T17:00:00Z");
const ASKABLE: readonly AskableSkill[] = ["callback", "inquiry", "showup", "catering", "callfollow", "closer", "reactivator", "keeper", "referral", "reviewer", "nudger", "posts", "reviewdrafter"];

/** Read `text` for the HVAC shop with `chosen` skills built, and insist it is a draft. */
function draft(text: string, chosen: readonly SkillId[]): DraftRequest {
  const request = readRequest(text, HVAC, chosen);
  if (request.kind !== "draft") throw new Error(`Expected a draft for "${text}", got ${request.kind}`);
  return request;
}

describe("readRequest: what counts as a request", () => {
  it.each([
    "We started doing catering",
    "We switched to Square",
    "Now we take EBT",
    "Email is how most customers reach us now",
    "Text messages are how customers reach us",
    "Tell me what you can do",
    "Remind me to renew my license",
    "Let's add Instagram",
    "What can you do?",
    "Posting on Instagram is new for us",
  ])("leaves %j to the profile reader", (text) => {
    expect(readRequest(text, HVAC, ["posts", "callback", "showup"])).toEqual({ kind: "none" });
  });

  it.each([
    "write a post about our new Taco Tuesday",
    "Can you please write a post about our new Taco Tuesday?",
    "Hey, could you write a post about our new Taco Tuesday",
    "I need a post about our new Taco Tuesday",
    "Let's post about our new Taco Tuesday",
  ])("reads %j as a request for a post", (text) => {
    expect(draft(text, ["posts"]).skill).toBe("posts");
  });
});

describe("readRequest: which agent drafts it", () => {
  it("hands a text about running late to the reminder skill when it is built", () => {
    expect(draft("text Dana we're running 20 minutes late", ["callback", "showup"]).skill).toBe("showup");
  });

  it("lets any agent that writes to customers take a message no cue points elsewhere", () => {
    expect(draft("text Dana we're running 20 minutes late", ["posts", "callback"]).skill).toBe("callback");
    expect(draft("tell Sam his part came in", ["inquiry"]).skill).toBe("inquiry");
  });

  it("matches the skill a request names", () => {
    expect(draft("email Sam about the estimate for the deck", ["inquiry", "closer"]).skill).toBe("closer");
    expect(draft("remind Jordan about invoice 1042", ["showup", "nudger"]).skill).toBe("nudger");
    expect(draft("reply to the review from Chris about the long wait", ["reviewer", "reviewdrafter"]).skill).toBe("reviewdrafter");
    expect(draft("ask the Nguyens for a review", ["reviewer", "reviewdrafter"]).skill).toBe("reviewer");
    expect(draft("Draft a renewal reminder for plan members", ["showup", "keeper"]).skill).toBe("keeper");
  });

  it("never drafts with a skill the owner didn't choose", () => {
    const request = readRequest("write a post about our new Taco Tuesday", HVAC, ["callback", "closer"]);

    expect(request.kind).toBe("unstaffed");
  });

  it("names the workflow in the plan that would do the work", () => {
    expect(readRequest("write a post about our new Taco Tuesday", HVAC, ["callback"])).toEqual({ kind: "unstaffed", skill: "posts", workflow: "social", planned: true });
  });

  it("says when the work's workflow isn't in the plan at all", () => {
    expect(readRequest("follow up on the quote we sent last week", { workflows: {} }, [])).toEqual({ kind: "unstaffed", skill: "closer", workflow: "quotes", planned: false });
  });

  it("drafts nothing about allergies", () => {
    expect(readRequest("reply to the customer who asked if the tacos have peanuts", HVAC, ["inquiry"])).toEqual({ kind: "allergy" });
  });

  it("lists what the agents can draft when it can't tell what the owner wants", () => {
    expect(readRequest("write something nice for the weekend", HVAC, ["posts", "callback", "brief"])).toEqual({ kind: "unclear", offers: ["posts", "callback"] });
  });

  it("drafts with the skills a real plan chooses by default", () => {
    const chosen = chosenSkills(HVAC, resolveChoices(HVAC, {}));

    expect(draft("text Dana we're running 20 minutes late", chosen).details.recipient).toBe("Dana");
  });

  it.each(ASKABLE)("reads the example request it suggests for %s as that skill's work", (skill) => {
    expect(draft(askExample([skill]), [skill]).skill).toBe(skill);
  });
});

describe("readRequest: the details", () => {
  it("reads who it goes to and what to say", () => {
    expect(draft("text Dana we're running 20 minutes late", ["callback"]).details).toMatchObject({ recipient: "Dana", say: "we're running 20 minutes late", channel: "sms" });
    expect(draft("Can you let dana know her part came in?", ["callback"]).details).toMatchObject({ recipient: "Dana", say: "her part came in" });
    expect(draft("send Dana a text saying we're on our way", ["callback"]).details).toMatchObject({ recipient: "Dana", say: "we're on our way", channel: "sms" });
  });

  it("reads a topic, and a phone number, email address or family as the recipient", () => {
    expect(draft("write a post about our new Taco Tuesday", ["posts"]).details).toMatchObject({ recipient: null, about: "our new Taco Tuesday" });
    expect(draft("text +1 301 555 0192 that we're on our way", ["callback"]).details).toMatchObject({ recipient: "+1 301 555 0192", say: "we're on our way" });
    expect(draft("email sam@example.com about the estimate", ["closer"]).details).toMatchObject({ recipient: "sam@example.com", channel: "email" });
    expect(draft("follow up with the Lewis family about their quote", ["closer"]).details).toMatchObject({ recipient: "the Lewis family", about: "their quote" });
  });

  it("finds no recipient in words that only sit where a name would", () => {
    expect(draft("text back the caller we missed this morning", ["callback"]).details.recipient).toBeNull();
    expect(draft("ask our last customer for a Google review", ["reviewer"]).details.recipient).toBeNull();
  });

  it("titles the card with the request, without the polite opening", () => {
    expect(draft("Could you please text Dana we're running 20 minutes late?", ["callback"]).details.ask).toBe("Text Dana we're running 20 minutes late");
  });
});

describe("requestCard and ruleWords", () => {
  it("drafts a text in the owner's words that ends with the opt-out line and passes the send check", () => {
    const request = draft("text Dana we're running 20 minutes late", ["callback"]);
    const card = requestCard(HVAC, request, ruleWords(HVAC, request));

    expect(card).toMatchObject({ title: "Text Dana we're running 20 minutes late", channel: "sms", action: "Send text", to: "Dana" });
    expect(card.body).toBe(`Hi Dana, it's College Park Heating & Air. We're running 20 minutes late. ${OPT_OUT_LINE}`);
    expect(card.checks).toContain(QUIET_HOURS_RULE);
    expect(checkSend({ ...card, agent: "frontdesk", skill: "callback" }, { now: NOON, timeZone: "America/New_York", hasConsent: true })).toEqual({ ok: true });
  });

  it("speaks to the customer, not about them", () => {
    const request = draft("let Dana know her part came in and we'll call her tomorrow", ["callback"]);

    expect(ruleWords(HVAC, request)).toBe("Hi Dana, it's College Park Heating & Air. Your part came in and we'll call you tomorrow.");
  });

  it("drafts a post to copy, about what the owner named", () => {
    const shop = { ...HVAC, name: "Rosa's Taqueria", reach: ["Walk-ins"] };
    const request = draft("write a post about our new Taco Tuesday", ["posts"]);
    const card = requestCard(shop, request, ruleWords(shop, request));

    expect(card).toMatchObject({ channel: "list", action: "Copy post" });
    expect(card.body).toBe(`Draft post for Rosa's Taqueria: "News from Rosa's Taqueria: our new Taco Tuesday. Stop by this week, or call ahead to book a time."`);
  });

  it("sends an email when the owner says email, and invents nothing when they give no words", () => {
    const request = draft("email the Nguyens to ask for a review", ["reviewer"]);
    const card = requestCard(HVAC, request, ruleWords(HVAC, request));

    expect(card).toMatchObject({ channel: "email", action: "Send email", to: "the Nguyens" });
    expect(card.body).toBe("Hi, it's College Park Heating & Air. Thanks for choosing us! If we did right by you, a Google review helps neighbors find us.");
  });

  it("ties a chat card's key to the reply that drafted it", () => {
    expect(chatCardKey("hvac", "42")).toBe("hvac:chat:42");
  });
});

describe("what Anchored replies", () => {
  it("says which agent drafted what, and that nothing goes out before approval", () => {
    expect(draftedReply(draft("text Dana we're running 20 minutes late", ["callback"]), "Front Desk")).toBe(
      "Front Desk drafted a text to Dana. It's waiting in Approvals, and nothing goes out until you approve it.",
    );
  });

  it.each<[Exclude<ChatRequest, { kind: "none" | "draft" }>, string]>([
    [{ kind: "unstaffed", skill: "posts", workflow: "social", planned: true }, `In Workflows, pick "Let Anchored draft it for your OK" there`],
    [{ kind: "unstaffed", skill: "posts", workflow: "social", planned: true }, `"Social posts and marketing"`],
    [{ kind: "unstaffed", skill: "closer", workflow: "quotes", planned: false }, `"Quotes and estimates" isn't in your plan yet`],
    [{ kind: "allergy" }, "Anything about allergies comes from you"],
    [{ kind: "unclear", offers: ["posts", "closer"] }, `a post or a check-in on a quote. Say which, like "Write a post for our Google listing"`],
    [{ kind: "unclear", offers: [] }, `pick "Let Anchored draft it for your OK" on a workflow`],
  ])("answers %j in plain words", (request, words) => {
    expect(declineReply(request)).toContain(words);
  });
});
