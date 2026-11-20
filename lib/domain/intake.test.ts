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
  applyListing,
  draftDetails,
  readDetailChanges,
  withListingChoices,
  wantsInvoiceSheet,
} from "@/lib/domain/intake";
import { PATH_OUTCOME } from "@/lib/domain/workflows";

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

/** Skip each gap question until the review, returning the draft and the gap steps asked. */
function throughGaps(start: IntakeDraft): { draft: IntakeDraft; gaps: string[] } {
  let draft = start;
  const gaps: string[] = [];
  while (question(draft).field.startsWith("gap:")) {
    gaps.push(question(draft).field);
    draft = answer(draft, text("skip"));
  }
  return { draft, gaps };
}

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
    // The prices came from the "what" answer and the quotes fact gave the pricing method, so the gaps ask the rest.
    expect(draft.details?.prices).toEqual([
      { item: "Weekly mowing", low: 45 },
      { item: "spring cleanups", low: 350 },
    ]);
    expect(draft.details?.pricingMethod).toBe("quote");
    const firstGap = question(draft);
    expect(firstGap.field).toBe("gap:vocabulary");
    expect(firstGap.text).toContain('From what you told me ("Home services")');
    expect(firstGap.options?.map((option) => option.label)).toEqual(["That's right"]);
    const { draft: reviewed, gaps } = throughGaps(answer(draft, picks("yes")));
    expect(reviewed.evidence?.vocabulary?.ownerConfirmed).toBe(true);
    expect(gaps.length).toBeLessThanOrEqual(2);
    const confirm = question(reviewed);
    expect(confirm.field).toBe("confirm");
    expect(confirm.text).toContain("Business: Greenfield Lawn & Landscape, Bowie, MD");
    expect(confirm.options?.map((option) => option.label)).toEqual(["Looks right", "Change something"]);
    expect(confirm.text).toContain("Prices: Weekly mowing $45, spring cleanups $350");
    expect(isComplete(applyAnswer(reviewed, "confirm", picks("yes")))).toBe(true);
  });

  it("asks at most three gap questions, plainly with a format example when nothing suggests a value", () => {
    const { draft } = converse([
      text("Ridge Dental, Laurel, MD"),
      text("dental office"),
      text("Cleanings and fillings"),
      picks("Phone calls"),
      picks(),
      picks("appointments"),
      picks("English"),
      text("Reminder calls"),
      text("See you Tuesday!"),
    ]);
    const first = question(draft);
    expect(first.field).toMatch(/^gap:/);
    // A dental office has no usual words, so the question carries a format example and no invented value.
    expect(first.text).toMatch(/For example: /);
    expect(first.options ?? []).not.toContainEqual(expect.objectContaining({ value: "yes" }));
    const { gaps } = throughGaps(draft);
    expect(gaps.length).toBe(3);
  });

  it("reads a typed gap answer into the detail, and keeps going when the owner skips", () => {
    const start = converse([
      text("Ridge Dental, Laurel, MD"),
      text("dental office"),
      text("Cleanings and fillings"),
      picks("Phone calls"),
      picks(),
      picks("appointments"),
      picks("English"),
      text("Reminder calls"),
      text("See you Tuesday!"),
    ]).draft;
    const step = question(start).field;
    expect(step).toBe("gap:vocabulary");
    const after = answer(start, text("patients, and a visit"));
    expect(after.details?.vocabulary).toMatchObject({ customer: "patient", workUnit: "visit" });
    expect(after.evidence?.vocabulary).toMatchObject({ sourceType: "owner", confidence: "high" });
    expect(question(after).field).not.toBe("gap:vocabulary");
  });

  const plumber = (): IntakeDraft =>
    converse([
      text("Brightwater Plumbing, Silver Spring, MD"),
      picks("Home services"),
      text("Drain cleaning and water heaters for homeowners"),
      picks("Phone calls"),
      picks(),
      picks("quotes"),
      picks("English"),
      text("Calling people back"),
      text("Hey Mrs. Patel, Mike from Brightwater here. I can come by Thursday."),
    ]).draft;

  it("applies a vocabulary correction to only the word it names", () => {
    const start = plumber();
    expect(question(start).field).toBe("gap:vocabulary");

    const after = answer(start, text("Mostly, but we call a booking a service call, not a visit."));

    expect(after.details?.vocabulary).toEqual({ customer: "customer", workUnit: "job", priceTerm: "estimate", bookingTerm: "service call" });
  });

  it("keeps the old words and asks once more when it can't tell which word a correction changes", () => {
    const start = plumber();
    const before = start.details?.vocabulary;

    const once = answer(start, text("Mostly, but some of it is a bit different for us."));

    expect(once.details?.vocabulary).toEqual(before);
    expect(question(once).field).toBe("gap:vocabulary");
    const twice = answer(once, text("Hard to say really."));
    expect(twice.details?.vocabulary).toEqual(before);
    expect(question(twice).field).not.toBe("gap:vocabulary");
  });

  it("reads the owner's first name from a voice sample that signs it, so it never asks for it", () => {
    const draft = plumber();

    expect(draft.details?.ownerName).toBe("Mike");
    expect(throughGaps(draft).gaps).not.toContain("gap:ownerName");
  });

  it("asks once more after a vague answer about what the business sells, and never stores it", () => {
    const atWhat = converse([text("Brightwater Plumbing, Silver Spring, MD"), picks("Home services")]).draft;

    const vague = answer(atWhat, text("oh, you know, the usual stuff"));

    expect(vague.facts.what).toBeUndefined();
    expect(question(vague).field).toBe("what");
    expect(composeReply(atWhat, vague, "what", readAnswer("oh, you know, the usual stuff", "what"), "Thanks for clarifying those services.")).not.toMatch(/thanks for clarifying/i);
    const still = answer(vague, text("just the usual stuff really"));
    expect(still.facts.what).toBeUndefined();
    expect(question(still).field).toBe("reach");
  });

  it("applies a correction to what the business sells made inside another answer", () => {
    const atLanguages = converse([
      text("Brightwater Plumbing, Silver Spring, MD"),
      picks("Home services"),
      text("Plumbing for homeowners"),
      picks("Phone calls"),
      picks(),
      picks("quotes"),
    ]).draft;
    expect(question(atLanguages).field).toBe("languages");
    const said = "English and Spanish. And sorry, to correct my earlier answer: we do drain cleaning, water heater installs and emergency leak repair.";

    const after = answer(atLanguages, text(said));

    expect(after.facts.languages).toEqual(["English", "Spanish"]);
    expect(after.facts.what).toBe("Drain cleaning, water heater installs and emergency leak repair");
  });

  it("drops a model acknowledgement that claims a correction nobody applied", () => {
    const atLanguages = converse([text("Brightwater Plumbing, Silver Spring, MD"), picks("Home services"), text("Plumbing for homeowners"), picks("Phone calls"), picks(), picks("quotes")]).draft;
    const after = answer(atLanguages, text("English and Spanish"));

    const reply = composeReply(atLanguages, after, "languages", readAnswer("English and Spanish", "languages"), "Thanks for the languages and service corrections.");

    expect(reply).not.toMatch(/correction/i);
  });

  it("offers a plumber only the chips and words that fit the trade", () => {
    const named = converse([text("Brightwater Plumbing, Silver Spring, MD"), picks("Home services"), text("Drain cleaning and water heaters for homeowners")]).draft;
    const labels = (draft: IntakeDraft) => (question(draft).options ?? []).map((option) => option.label);

    expect(labels(named)).not.toEqual(expect.arrayContaining(["Walk-ins"]));
    expect(labels(named)).not.toContain("Delivery apps");
    const signals = answer(answer(named, picks("Phone calls")), picks());
    expect(question(signals).field).toBe("signals");
    expect(labels(signals).join(" ")).not.toMatch(/catering|SNAP|tables/i);
    expect(labels(signals)).toContain("Customers book appointments");
  });

  it("keeps every chip for a trade it doesn't know", () => {
    const named = converse([text("Ridge Dental, Laurel, MD"), text("dental office"), text("Cleanings and fillings")]).draft;

    expect((question(named).options ?? []).map((option) => option.label)).toEqual(expect.arrayContaining(["Walk-ins", "Delivery apps"]));
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
  const planned = converse([
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
  const finished = throughGaps(planned).draft;

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

  it("keeps the owner's plan approval, so a workflow the change adds shows as a change to approve", () => {
    const approval = { approvedAt: "2026-11-07T15:30:00.000Z", choices: {} };
    const { profile } = applyChanges({ ...cafe, planApproval: approval }, readChanges("we started doing catering"));
    expect(profile.planApproval).toEqual(approval);
  });

  it("groups new paths in the reply", () => {
    const reply = changeReply(
      [
        { op: "added", area: "tool", label: "Clover" },
        { op: "removed", area: "tool", label: "Square" },
        { op: "changed", area: "path", label: "Social posts and marketing", to: PATH_OUTCOME.build },
        { op: "changed", area: "path", label: "Staff scheduling", to: PATH_OUTCOME.build },
      ],
      "Corner Cafe",
    );
    expect(reply).toBe(
      "Updated your profile: added Clover; removed Square. Your plan now suggests Anchored's drafts for Social posts and marketing and Staff scheduling.",
    );
  });

  it("names a new pick by who would handle the work, never by its path", () => {
    expect(Object.values(PATH_OUTCOME)).toEqual(["a tool you have", "a new tool", "Anchored's drafts", "no help yet"]);
  });

  it("replies plainly when nothing changed", () => {
    const { changes } = applyChanges(cafe, readChanges("what's the weather like"));
    expect(changes).toEqual([]);
    expect(changeReply(changes, "Corner Cafe")).toContain("didn't spot a change");
  });
});

describe("details in business chat", () => {
  const shop = profileFromFacts({ name: "Apex Heating", trade: "HVAC contractor", tradeKey: "home", reach: ["Phone calls"], tools: [], signals: ["quotes"] });
  const withHours = { ...shop, details: { hours: "Mon to Fri 8 to 6" }, evidence: { hours: { sourceType: "listing", quote: "8 to 6", confidence: "high", ownerConfirmed: true } }, placeId: "place-1", version: 3 } as const;

  it("reads a new minimum and prices as the owner's own, confirmed", () => {
    const { profile, changes } = applyChanges(withHours, readChanges("Our minimum is now $89, and a tune-up costs $129"));

    expect(profile.details).toMatchObject({ minimumCharge: 89, prices: [{ item: "tune-up", low: 129 }], hours: "Mon to Fri 8 to 6" });
    expect(profile.evidence?.minimumCharge).toMatchObject({ sourceType: "owner", ownerConfirmed: true });
    expect(changes).toContainEqual({ op: "added", area: "detail", label: "Minimum charge", to: "$89" });
    expect(changeReply(changes, profile.name)).toContain("minimum charge to $89");
  });

  it("keeps the details, listing and version when a chat message changes something else", () => {
    const { profile } = applyChanges(withHours, readChanges("We started using QuickBooks Online"));

    expect(profile.tools).toContain("QuickBooks Online");
    expect(profile.details?.hours).toBe("Mon to Fri 8 to 6");
    expect(profile.placeId).toBe("place-1");
    expect(profile.version).toBe(3);
  });

  it("reads no detail from a message that states none", () => {
    expect(readDetailChanges("We started doing catering")).toEqual([]);
  });

  it("reads the owner's first name however the sentence starts", () => {
    expect(readDetailChanges("I'm Mike, by the way")).toMatchObject([{ key: "ownerName", value: "Mike" }]);
    expect(readDetailChanges("My name is mike")).toMatchObject([{ key: "ownerName", value: "Mike" }]);
    expect(readDetailChanges("I'm not sure we open Sundays")).toEqual([]);
  });
});

describe("the listing step", () => {
  const named = applyAnswer(newDraft(), "name", text("Apex Heating, Laurel, MD"));
  const choices = [
    { id: "place-a", name: "Apex Heating & Air", address: "1 Main St, Laurel, MD", rating: 4.8 },
    { id: "place-b", name: "Apex Plumbing", address: "9 Elm St, Laurel, MD" },
  ];

  it("drops a listing's value when the owner says it is wrong, so confirming never makes it theirs", () => {
    const hours = { key: "hours", value: "9 to 5", sourceType: "listing", quote: "Open 9-5", confidence: "medium" } as const;
    const listed = applyListing(withListingChoices(named, choices), "place-a", [hours]);
    expect(listed.details?.hours).toBe("9 to 5");

    for (const reply of ["no", "wrong"]) {
      const answered = applyAnswer(listed, "gap:hours", text(reply));
      expect(draftDetails(answered).details?.hours).toBeUndefined();
      expect(answered.gaps).toContain("hours");
    }
  });

  it("asks right after the name, with each match and a way to say none", () => {
    const draft = withListingChoices(named, choices);
    const listing = question(draft);

    expect(listing.field).toBe("listing");
    expect(listing.options?.map((option) => option.label)).toEqual(["Apex Heating & Air, 1 Main St, Laurel, MD", "Apex Plumbing, 9 Elm St, Laurel, MD", "Not listed"]);
  });

  it("keeps the pick and its facts as listing evidence, and moves on", () => {
    const draft = withListingChoices(named, choices);
    const after = applyListing(draft, "place-a", [{ key: "hours", value: "Mon to Fri 8 to 5", sourceType: "listing", quote: "Mon to Fri 8 to 5", confidence: "high" }]);

    expect(after.placeId).toBe("place-a");
    expect(after.evidence?.hours?.sourceType).toBe("listing");
    expect(question(after).field).toBe("kind");
    expect(summarize(after)).toContainEqual(expect.objectContaining({ field: "hours", value: "Mon to Fri 8 to 5", source: "From your Google listing" }));
  });

  it("ignores an id that wasn't offered, and skips the step when Google found nothing", () => {
    const draft = withListingChoices(named, choices);

    expect(applyListing(draft, "place-z", []).placeId).toBeUndefined();
    expect(question(withListingChoices(named, [])).field).toBe("kind");
  });

  it("hands the confirmed details and listing to the business", () => {
    const after = applyListing(withListingChoices(named, choices), "place-a", [{ key: "hours", value: "8 to 5", sourceType: "listing", quote: "8 to 5", confidence: "high" }]);

    expect(draftDetails(after)).toEqual({
      details: { hours: "8 to 5" },
      evidence: { hours: { sourceType: "listing", quote: "8 to 5", confidence: "high", ownerConfirmed: true } },
      placeId: "place-a",
    });
  });
});

describe("the invoice sheet question", () => {
  const LINK = "https://docs.google.com/spreadsheets/d/1u8jzPde0IgxLd6GncfBAepfJBd0Kh8oOOL8dKLzdocJ/edit";
  /** A coaching agency through the nine planned questions and the gaps, with the tools answer given. */
  const coaching = (tools: IntakeAnswer) =>
    throughGaps(
      converse([
        text("Brightpath Coaching, College Park"),
        picks("Professional services"),
        text("1-on-1 career coaching, sessions $175, a 3-session package $450, a $1,200 a month retainer"),
        picks("Email", "Referrals"),
        tools,
        picks("appointments", "memberships"),
        picks("English"),
        text("Chasing clients who pay their invoices late"),
        text("Hi Maya, thanks for reaching out! I have Tuesday at 10 or Thursday at 2."),
      ]).draft,
    ).draft;

  it("asks for the sheet after the gaps when the owner uses Google Sheets and Bookkeeping is planned", () => {
    const draft = coaching(text("Google Sheets, Calendly and Zoom"));
    expect(wantsInvoiceSheet(draft)).toBe(true);
    const asked = question(draft);
    expect(asked.field).toBe("sheet");
    expect(asked.text).toContain("paste its link here");
    expect(asked.options?.map((option) => option.label)).toEqual(["Skip for now"]);
  });

  it("keeps the pasted link's sheet ID, then moves on to the review", () => {
    const answered = answer(coaching(text("Google Sheets")), text(`here it is ${LINK}`));
    expect(answered.invoiceSheet).toEqual({ id: "1u8jzPde0IgxLd6GncfBAepfJBd0Kh8oOOL8dKLzdocJ" });
    expect(question(answered).field).toBe("confirm");
  });

  it("asks only once, and a skip leaves no sheet", () => {
    const skipped = answer(coaching(text("Google Sheets")), picks("skip"));
    expect(skipped.invoiceSheet).toEqual({ id: null });
    expect(wantsInvoiceSheet(skipped)).toBe(false);
    expect(question(skipped).field).toBe("confirm");
  });

  it("doesn't ask an owner who doesn't use Google Sheets", () => {
    const draft = coaching(picks("QuickBooks Online"));
    expect(wantsInvoiceSheet(draft)).toBe(false);
    expect(question(draft).field).toBe("confirm");
  });
});
