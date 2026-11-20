import { describe, expect, it } from "vitest";
import { profileFromFacts } from "./engine";
import { POST_PLATFORMS, checkHashtags } from "./playbook";
import { PLAYBOOK_SEED } from "./playbook-seed";
import { POST_BRIEF_QUESTION, aiTells, askedForBrief, asksForPostHelp, briefIsUsable, hasBlanks, planPost, postTitle, postsInLastDay, readBrief, ruleCaption, unbackedClaims, wantsPhotoPost } from "./posts";

const hvac = profileFromFacts({ name: "College Park Heating & Air", trade: "HVAC", tradeKey: "home", place: "College Park, MD", reach: ["Phone calls"], tools: [], signals: [] });
const bakery = profileFromFacts({ name: "Rise Bakery", trade: "bakery", tradeKey: "restaurant", place: "Hyattsville, MD", reach: ["Walk-ins"], tools: [], signals: [] });

describe("planPost", () => {
  it("plans a before and after carousel with HVAC and local hashtags for a furnace job", () => {
    const plan = planPost(PLAYBOOK_SEED, hvac, "Before and after of a furnace replacement", 3);
    expect(plan.instagram.format.id).toBe("before-after");
    expect(plan.linkedin.format.id).toBe("before-after");
    expect(plan.instagram.hashtags[0]).toBe("#CollegePark");
    expect(plan.instagram.hashtags).toContain("#HVAC");
    expect(plan.instagram.hooks[0]?.formats).toContain("before-after");
  });

  it("gives a bakery restaurant formats and no trade tags from other trades", () => {
    const plan = planPost(PLAYBOOK_SEED, bakery, "Our sourdough, made from scratch every morning", 4);
    expect(plan.instagram.format.id).toBe("how-its-made");
    expect(plan.instagram.hashtags).toContain("#Bakery");
    expect(plan.instagram.hashtags).not.toContain("#HVAC");
  });

  it("still plans every platform for a single photo", () => {
    const plan = planPost(PLAYBOOK_SEED, hvac, "New furnace installed today", 1);
    for (const p of POST_PLATFORMS) expect(plan[p].format.minPhotos).toBe(1);
  });

  it("falls back to a general format when the playbook is empty", () => {
    const plan = planPost({ formats: [], hooks: [], hashtags: [] }, hvac, "anything", 2);
    expect(plan.facebook.format.id).toBe("general");
  });
});

describe("ruleCaption", () => {
  it("passes every platform's hashtag check and leaves no blanks", () => {
    const description = "Before and after of a furnace replacement";
    const plan = planPost(PLAYBOOK_SEED, hvac, description, 3);
    for (const p of POST_PLATFORMS) {
      const caption = ruleCaption(hvac, plan[p], description);
      expect(checkHashtags(caption, p, plan[p].hashtags), p).toBeNull();
      expect(hasBlanks(caption), p).toBe(false);
      expect(caption).toContain("Before and after of a furnace replacement.");
    }
  });

  it("makes LinkedIn longer than Instagram", () => {
    const plan = planPost(PLAYBOOK_SEED, hvac, "Furnace tune-up", 1);
    expect(ruleCaption(hvac, plan.linkedin, "Furnace tune-up").length).toBeGreaterThan(ruleCaption(hvac, plan.instagram, "Furnace tune-up").length);
  });
});

describe("unbackedClaims", () => {
  it("refuses awards, guarantees, rankings, credentials and deals the owner didn't state", () => {
    expect(unbackedClaims("new furnace", "Our award-winning team, fully licensed and guaranteed. 20% off!")).toEqual(["an award", "a guarantee", "a credential", "a deal"]);
    expect(unbackedClaims("new furnace", "The best in town.")).toEqual(["a ranking"]);
  });

  it("allows a claim the owner made, ordinary words, and hashtags", () => {
    expect(unbackedClaims("we're licensed and insured", "Licensed and insured, as always.")).toEqual([]);
    expect(unbackedClaims("new furnace", "We did our best work here. #BestInTown")).toEqual([]);
    expect(unbackedClaims("new furnace", "Feel free to send us a message.")).toEqual([]);
  });

  it("catches a #1 ranking, which isn't a hashtag", () => {
    expect(unbackedClaims("new furnace", "We're #1 in College Park.")).toEqual(["a ranking"]);
  });
});

describe("aiTells", () => {
  it("finds machine-sounding phrases", () => {
    expect(aiTells("This furnace is a testament to our work. It's not just a repair, it's a fresh start.")).toEqual(["testament to", "It's not just"]);
    expect(aiTells("Nestled in College Park, we elevate your comfort.")).toEqual(["elevate", "Nestled"]);
  });

  it("leaves plain writing alone", () => {
    expect(aiTells("Swapped out a rusted furnace in a 1950s house today. Message us if yours is making noise.")).toEqual([]);
  });
});

describe("postsInLastDay and postTitle", () => {
  it("counts only photo posts from the last 24 hours", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const cards = [
      { post: {}, createdAt: "2026-11-08T11:00:00Z" },
      { post: {}, createdAt: "2026-11-07T11:00:00Z" },
      { createdAt: "2026-11-08T11:30:00Z" },
    ];
    expect(postsInLastDay(cards, now)).toBe(1);
  });

  it("keeps short titles whole and cuts long ones at a word", () => {
    expect(postTitle("New furnace")).toBe("Post: New furnace");
    const long = postTitle("Before and after of a furnace replacement in a 1950s house in College Park, the old unit was rusted");
    expect(long.length).toBeLessThanOrEqual(70);
    expect(long).toMatch(/^Post: Before and after .*\.\.\.$/);
  });
});

describe("readBrief", () => {
  it("splits the Nov 8 tester's brief into what the post is about and how to write it", () => {
    const brief = readBrief(
      "Marketing test: make a carousel caption about a classroom event. These three photos show a projected presentation, attendees seated with laptops, and a wide view of the room. The goal is to share an event recap. Use a warm, factual tone. Do not identify attendees or invent the event name, date, organizer, or a connection to Maple Street Café. Draft only.",
    );
    expect(brief.about).toBe("A classroom event. A projected presentation, attendees seated with laptops, and a wide view of the room.");
    expect(brief.asks).toEqual([
      "make a carousel caption about a classroom event.",
      "The goal is to share an event recap.",
      "Use a warm, factual tone.",
      "Do not identify attendees or invent the event name, date, organizer, or a connection to Maple Street Café.",
      "Draft only.",
    ]);
  });

  it("keeps a plain description whole", () => {
    expect(readBrief("Before and after of a furnace replacement in a 1950s house. The old unit was rusted out.")).toEqual({
      about: "Before and after of a furnace replacement in a 1950s house. The old unit was rusted out.",
      asks: [],
    });
  });

  it("finds nothing to write about in instructions alone", () => {
    expect(briefIsUsable(readBrief("Draft only. Use a warm tone."))).toBe(false);
    expect(briefIsUsable(readBrief("New patio"))).toBe(true);
  });
});

describe("asking for posts", () => {
  it.each([
    "Marketing is our top priority. Can you help turn our classroom event photos into social posts?",
    "please help us make a carousel",
    "We have a marketing problem",
    "Can you make an Instagram post from these pictures?",
  ])("hears %j as asking for post help", (text) => {
    expect(asksForPostHelp(text)).toBe(true);
  });

  it.each(["We started posting on Instagram", "Write a post about this week's special", "We now take EBT", "Text Dana we're running late"])("leaves %j to the other readers", (text) => {
    expect(asksForPostHelp(text)).toBe(false);
  });

  it("sends only photo and carousel asks straight to photo posts", () => {
    expect(wantsPhotoPost("please help us make a carousel")).toBe(true);
    expect(wantsPhotoPost("Help me write an Instagram post about our sale")).toBe(false);
  });

  it("knows when Anchored's message asked the post question", () => {
    expect(askedForBrief(`Happy to help with that. ${POST_BRIEF_QUESTION} Add your photos.`)).toBe(true);
    expect(askedForBrief("Updated your profile.")).toBe(false);
  });
});
