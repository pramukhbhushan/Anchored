import { describe, expect, it } from "vitest";
import { profileFromFacts } from "./engine";
import { POST_PLATFORMS, checkHashtags } from "./playbook";
import { PLAYBOOK_SEED } from "./playbook-seed";
import { hasBlanks, planPost, ruleCaption, unbackedClaims } from "./posts";

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
  });
});
