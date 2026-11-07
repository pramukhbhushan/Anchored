import { describe, expect, it } from "vitest";
import { profileFromAnswers, profileFromFacts } from "@/lib/domain/engine";
import {
  allowedLists,
  applyAnswer,
  applyChanges,
  changeReply,
  clip,
  composeReply,
  draftToAnswers,
  isComplete,
  MAX_FOLLOW_UPS,
  newDraft,
  nextQuestion,
  readAnswer,
  readChanges,
  summarize,
  withFollowUp,
  type IntakeAnswer,
  type IntakeDraft,
  type IntakeQuestion,
} from "@/lib/domain/intake";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of chat onboarding and chat updates: which question comes next, how
// typed and tapped answers become facts, the closing confirm step, and how a
// message like "we started doing catering" changes a running business.

/** Return the next question, failing the test when the intake is already complete. */
function question(draft: IntakeDraft): IntakeQuestion {
  const next = nextQuestion(draft);
  if (next === null) throw new Error("the intake is already complete");
  return next;
}

/** Answer whatever Anchored asks next. */
function answer(draft: IntakeDraft, reply: IntakeAnswer): IntakeDraft {
  return applyAnswer(draft, question(draft).field, reply);
}

/** Answer a run of questions in order, returning the final draft and every question asked. */
function converse(replies: readonly IntakeAnswer[]): { draft: IntakeDraft; asked: IntakeQuestion[] } {
  let draft = newDraft();
  const asked: IntakeQuestion[] = [];
  for (const reply of replies) {
    asked.push(question(draft));
    draft = answer(draft, reply);
  }
  return { draft, asked };
}

const text = (value: string): IntakeAnswer => ({ text: value });
const picks = (...values: string[]): IntakeAnswer => ({ picks: values });

describe("the question plan", () => {
  it("starts empty and asks for the name and town first", () => {
    const draft = newDraft();
    expect(question(draft).field).toBe("name");
    expect(summarize(draft).every((fact) => fact.state === "open")).toBe(true);
    expect(draftToAnswers(draft)).toMatchObject({ name: "", kind: "", reach: [], tools: [], signals: [], languages: [] });
  });

  it("covers the nine planned questions, then asks the owner to confirm", () => {
    const { draft, asked } = converse([
      text("Greenfield Lawn & Landscape, Bowie, MD"),
      picks("Home services"),
      text("Weekly mowing at $45 a visit and spring cleanups around $350, mostly homeowners"),
      picks("Phone calls", "Referrals", "Google"),
      picks("QuickBooks Online"),
      picks("quotes", "memberships"),
      picks("English", "Spanish"),
      text("Writing up quotes at night, calling people back"),
      text("Hey! Thanks for reaching out. I can swing by Thursday."),
    ]);
    expect(asked.map((q) => q.field)).toEqual(["name", "kind", "what", "reach", "tools", "signals", "languages", "week", "voice"]);
    const confirm = question(draft);
    expect(confirm.field).toBe("confirm");
    expect(confirm.text).toContain("Business: Greenfield Lawn & Landscape, Bowie, MD");
    expect(confirm.options?.map((option) => option.label)).toEqual(["Looks right", "Change something"]);
    expect(isComplete(applyAnswer(draft, "confirm", picks("yes")))).toBe(true);
  });

  it("fills several facts from one sentence and skips the questions they answer", () => {
    let draft = answer(newDraft(), text("I run a food truck in Baltimore that does catering"));
    expect(draft.facts).toMatchObject({ kind: "Food truck", place: "Baltimore" });
    expect(draft.facts.signals).toContain("catering");
    // The sentence gave no name, so Anchored asks for it once before moving on.
    expect(question(draft).text).toBe("And what's the business called?");
    draft = answer(draft, text("Rosa's Tacos"));
    expect(draft.facts.name).toBe("Rosa's Tacos");
    expect(question(draft).field).toBe("what");
  });

  it("reads a name with a description after it", () => {
    const draft = answer(newDraft(), text("We're Rosa's Tacos, a taco truck out of Baltimore"));
    expect(draft.facts).toMatchObject({ name: "Rosa's Tacos", kind: "Taco truck", place: "Baltimore" });
  });

  it("keeps a business name that starts with an article", () => {
    const draft = answer(newDraft(), text("A Cut Above Salon, Austin, TX"));
    expect(draft.facts).toMatchObject({ name: "A Cut Above Salon", place: "Austin, TX" });
    expect(draft.facts.kind).toBeUndefined();
  });

  it("suggests chips for the trade without selecting any", () => {
    const draft = answer(answer(newDraft(), text("Sunrise Bakery in Bowie")), text("a bakery and cafe"));
    const reach = question(answer(draft, text("Bread, cakes and catering trays from $60")));
    expect(reach.field).toBe("reach");
    expect(reach.options?.some((option) => option.selected)).toBe(false);
    // Restaurant hints lead the list, in the option list's own order.
    expect(reach.options?.slice(0, 4).map((option) => option.value)).toEqual(["Phone calls", "Walk-ins", "Google", "Delivery apps"]);
    expect(reach.options?.slice(0, 4).every((option) => option.suggested)).toBe(true);
  });

  it("lets the owner skip a question without recording anything", () => {
    const draft = answer(answer(newDraft(), text("skip")), text("not sure"));
    expect(draft.settled).toEqual(["name", "kind"]);
    expect(draft.facts.name).toBeUndefined();
    expect(summarize(draft).slice(0, 2).map((fact) => fact.state)).toEqual(["skipped", "skipped"]);
    expect(question(draft).field).toBe("what");
  });
});

describe("reading answers", () => {
  it("maps typed answers to the option lists by keywords", () => {
    const reading = readAnswer("Mostly Instagram DMs, word of mouth and some phone calls", "reach");
    expect(reading.facts.reach).toEqual(["Phone calls", "Instagram or Facebook", "Referrals"]);
    expect(readAnswer("walk-ups at lunch and emails for catering", "reach").facts.reach).toEqual(["Walk-ins", "Email"]);
  });

  it("treats a tapped selection as the whole answer, and an empty Done as none", () => {
    let draft: IntakeDraft = { ...newDraft(), settled: ["name", "kind", "what"], facts: { ...newDraft().facts, name: "X", kind: "Y", what: "Z", reach: ["Phone calls"] } };
    draft = answer(draft, picks("Walk-ins"));
    expect(draft.facts.reach).toEqual(["Walk-ins"]);
    draft = answer(draft, picks());
    expect(draft.facts.tools).toEqual([]);
    expect(draft.settled).toContain("tools");
  });

  it("records an answer of none as none, not skipped, and builds no tools from it", () => {
    const toTools: IntakeDraft = { ...newDraft(), settled: ["name", "kind", "what", "reach"], facts: { ...newDraft().facts, name: "X", kind: "Y", what: "Z" } };
    const toolsFact = (draft: IntakeDraft) => summarize(draft).find((fact) => fact.field === "tools");
    for (const reply of [picks(), text("None of these")]) {
      const draft = answer(toTools, reply);
      expect(toolsFact(draft)).toMatchObject({ state: "known", value: "None" });
      expect(profileFromAnswers(draftToAnswers(draft)).tools).toEqual([]);
    }
    expect(toolsFact(answer(toTools, text("skip")))).toMatchObject({ state: "skipped", value: null });
    expect(toolsFact(applyAnswer(answer(toTools, picks()), "tools", picks("Square")))).toMatchObject({ state: "known", value: "Square" });
  });

  describe("a list question the owner already answered in passing", () => {
    // The first answer named how customers get in touch, so the reach question only confirms it.
    const heard: IntakeDraft = {
      ...newDraft(),
      settled: ["name", "kind", "what"],
      facts: { ...newDraft().facts, name: "Paws on Wheels", kind: "Mobile dog grooming", what: "Grooming", reach: ["Phone calls", "Instagram or Facebook"] },
    };

    it("says what it heard instead of asking from scratch", () => {
      expect(question(heard).field).toBe("reach");
      expect(question(heard).text).toBe("Customers reach you by: Phone calls and Instagram or Facebook. Tap to add or remove any, or say that's right.");
    });

    it.each(["that's right", "yes", "no", "nope"])("keeps the list and moves on when the owner says %s", (reply) => {
      const next = answer(heard, text(reply));
      expect(next.facts.reach).toEqual(["Phone calls", "Instagram or Facebook"]);
      expect(next.settled).toContain("reach");
      expect(question(next).field).toBe("tools");
    });

    it("still records none for a list it knew nothing about", () => {
      const tools = answer(answer(heard, text("yes")), text("none"));
      expect(tools.facts.tools).toEqual([]);
      expect(tools.settled).toContain("tools");
    });
  });

  it("asks once more when a typed answer matches no option, then moves on", () => {
    const start: IntakeDraft = { ...newDraft(), settled: ["name", "kind", "what"], facts: { ...newDraft().facts, name: "X", kind: "Y", what: "Z" } };
    const once = answer(start, text("my cousin tells people"));
    expect(question(once).text).toContain("couldn't match");
    const twice = answer(once, text("honestly no clue"));
    expect(twice.settled).toContain("reach");
    expect(question(twice).field).toBe("tools");
  });

  it("keeps DoorDash and OpenTable when the owner names them as tools", () => {
    expect(readAnswer("DoorDash and OpenTable", "tools").facts.tools).toEqual(expect.arrayContaining(["DoorDash", "OpenTable"]));
    expect(allowedLists({ reach: [], tools: ["DoorDash", "opentable"], signals: [], languages: [] }).tools).toEqual(["OpenTable", "DoorDash"]);
  });

  it("reads texting as a way customers reach the business", () => {
    expect(readAnswer("They take bookings by text mostly", "reach").facts.reach).toContain("Phone calls");
  });

  it("gives an owner who tapped Home services the home trade", () => {
    const { draft } = converse([text("Comfort Pros, Bowie, MD"), picks("Home services")]);
    expect(profileFromAnswers(draftToAnswers(draft)).tradeKey).toBe("home");
  });

  it("never records facts the owner ruled out", () => {
    expect(readAnswer("We don't take EBT and I never post online", "week").facts.signals).toEqual([]);
    // Phone keyboards type a curly apostrophe.
    expect(readAnswer("We don’t take EBT", "week").facts.signals).toEqual([]);
    expect(readAnswer("No staff, just me", "what").facts.signals).toEqual([]);
    expect(readAnswer("we don't deliver, but we cater weddings", "what").facts.signals).toEqual(["catering"]);
  });

  it("reads common words as tools only when they name the tool", () => {
    expect(readAnswer("Avocado toast and square cakes", "what").facts.tools).toEqual([]);
    expect(readAnswer("toast and quickbooks", "tools").facts.tools).toEqual(["QuickBooks Online", "Toast"]);
    expect(readAnswer("We ring people up on Square", "week").facts.tools).toEqual(["Square"]);
  });

  it("keeps the voice sample whole and never mines it for facts", () => {
    const reading = readAnswer("Thanks for booking with us! We'll call to confirm.", "voice");
    expect(reading.facts.voice).toBe("Thanks for booking with us! We'll call to confirm.");
    expect(reading.facts.signals).toEqual([]);
    expect(reading.facts.reach).toEqual([]);
  });

  it("caps follow-ups at the budget", () => {
    let draft: IntakeDraft | null = newDraft();
    for (let i = 0; i < MAX_FOLLOW_UPS; i++) draft = draft && withFollowUp({ ...draft, followUp: null }, "what", "More?");
    expect(draft).not.toBeNull();
    expect(withFollowUp({ ...(draft ?? newDraft()), followUp: null }, "what", "More?")).toBeNull();
  });
});

describe("the closing review", () => {
  const finished = converse([
    text("Sunrise Bakery, Bowie, MD"),
    text("bakery"),
    text("Cakes and catering trays from $60"),
    picks("Walk-ins"),
    picks("Square"),
    picks("suppliers", "catering"),
    picks("English"),
    text("Checking flour and butter prices on supplier invoices"),
    text("Thanks so much! Your order is ready at 3."),
  ]).draft;

  it("lets the owner change one part, then confirms again", () => {
    let draft = applyAnswer(finished, "confirm", picks("change"));
    expect(question(draft).field).toBe("change");
    draft = applyAnswer(draft, "change", picks("tools"));
    const tools = question(draft);
    expect(tools.field).toBe("tools");
    expect(tools.options?.find((option) => option.value === "Square")?.selected).toBe(true);
    const before = draft;
    draft = applyAnswer(draft, "tools", picks("Square", "QuickBooks Online"));
    expect(draft.facts.tools).toEqual(["QuickBooks Online", "Square"]);
    expect(question(draft).field).toBe("confirm");
    expect(composeReply(before, draft, "tools", readAnswer("", "tools"))).toMatch(/^Updated\. Here's the profile/);
  });

  it("applies a typed correction at the review and asks again", () => {
    const draft = applyAnswer(finished, "confirm", text("we also take EBT"));
    expect(draft.facts.signals).toContain("snap");
    expect(question(draft).field).toBe("confirm");
  });

  it("records catering as a lead source, so lead follow-up is planned", () => {
    const profile = profileFromAnswers(draftToAnswers(applyAnswer(finished, "confirm", text("looks good"))));
    expect(profile.name).toBe("Sunrise Bakery");
    expect(profile.place).toBe("Bowie, MD");
    expect(profile.workflows.catering).toBeDefined();
    expect(profile.workflows.leads?.fit).toBeGreaterThanOrEqual(2);
    // Phone calls were never mentioned, so they stay out of the profile.
    expect(profile.reach).not.toContain("Phone calls");
  });
});

describe("text handling", () => {
  it("cuts at a word boundary", () => {
    expect(clip("Cakes and catering trays from $60. Seasonal pies too.", 40)).toBe("Cakes and catering trays from $60...");
    expect(clip("short", 40)).toBe("short");
  });
});

describe("business chat changes", () => {
  const cafe = profileFromFacts({
    id: "b_test",
    name: "Corner Cafe",
    trade: "Cafe",
    tradeKey: "restaurant",
    reach: ["Walk-ins", "Google"],
    tools: ["Clover"],
    signals: ["suppliers"],
    voice: "Thanks, see you soon!",
  });

  it.each([
    ["Also we're called Brightpath Credit now", "Brightpath Credit"],
    ["We renamed the business to Brightpath Credit these days.", "Brightpath Credit"],
    ["Our new name is Brightpath Credit instead", "Brightpath Credit"],
    ["We're now called Brightpath Credit from now on!", "Brightpath Credit"],
  ])("drops trailing filler from a new name: %s", (message, name) => {
    expect(readChanges(message).texts.name).toBe(name);
  });

  it("reads additions, removals and switches", () => {
    expect(readChanges("We started doing catering").add.signals).toEqual(["catering"]);
    expect(readChanges("We stopped taking EBT").remove.signals).toEqual(["snap"]);
    const switched = readChanges("We switched from Clover to Square");
    expect(switched.add.tools).toEqual(["Square"]);
    expect(switched.remove.tools).toContain("Clover");
    expect(readChanges("we switched to Square").remove.tools).toEqual(expect.arrayContaining(["Clover", "Toast", "Cash register"]));
  });

  it("adds a workflow and says so, keeping the id, name and voice", () => {
    const { profile, changes } = applyChanges(cafe, readChanges("we started doing catering for offices"));
    expect(profile).toMatchObject({ id: "b_test", name: "Corner Cafe", voice: "Thanks, see you soon!", builtBy: "rules" });
    expect(profile.workflows.catering).toBeDefined();
    expect(changes).toContainEqual({ op: "added", area: "workflow", label: "Catering and events" });
    expect(changeReply(changes, profile.name)).toMatch(/^Added Catering and events to your workflows\./);
  });

  it("keeps written text for workflows whose rules didn't change", () => {
    const invoices = cafe.workflows.invoices;
    if (invoices === undefined) throw new Error("the cafe buys from suppliers, so it should have the invoices workflow");
    const written = { ...cafe, workflows: { ...cafe.workflows, invoices: { ...invoices, why: "Sysco raised dairy twice this spring." } } };
    const { profile } = applyChanges(written, readChanges("we started doing catering"));
    expect(profile.workflows.invoices?.why).toBe("Sysco raised dairy twice this spring.");
  });

  it("groups new paths in the reply", () => {
    const reply = changeReply(
      [
        { op: "added", area: "tool", label: "Clover" },
        { op: "removed", area: "tool", label: "Square" },
        { op: "changed", area: "path", label: "Social posts and marketing", to: "Build" },
        { op: "changed", area: "path", label: "Staff scheduling", to: "Build" },
      ],
      "Corner Cafe",
    );
    expect(reply).toBe("Updated your profile: added Clover; removed Square. Your plan now suggests Build for Social posts and marketing and Staff scheduling.");
  });

  it("replies plainly when nothing changed", () => {
    const { changes } = applyChanges(cafe, readChanges("what's the weather like"));
    expect(changes).toEqual([]);
    expect(changeReply(changes, "Corner Cafe")).toContain("didn't spot a change");
  });
});
