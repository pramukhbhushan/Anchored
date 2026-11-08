import { describe, expect, it } from "vitest";
import {
  POST_PLATFORMS,
  checkHashtags,
  hashtagId,
  hashtagsFor,
  hooksFor,
  localTag,
  pickFormats,
  playbookForNiche,
  type PlaybookNiche,
} from "./playbook";
import { PLAYBOOK_SEED } from "./playbook-seed";

const NICHES: readonly PlaybookNiche[] = ["home", "restaurant", "store", "coach"];
const { formats, hooks, hashtags } = PLAYBOOK_SEED;

describe("PLAYBOOK_SEED", () => {
  it("has unique ids for formats, hooks and hashtags", () => {
    expect(new Set(formats.map((f) => f.id)).size).toBe(formats.length);
    expect(new Set(hooks.map((h) => h.id)).size).toBe(hooks.length);
    expect(new Set(hashtags.map(hashtagId)).size).toBe(hashtags.length);
  });

  it("points every hook at formats that exist and share a platform", () => {
    const byId = new Map(formats.map((f) => [f.id, f]));
    for (const hook of hooks) {
      for (const id of hook.formats) {
        const format = byId.get(id);
        expect(format, `${hook.id} names ${id}`).toBeDefined();
        expect(hook.platforms.some((p) => format!.platforms.includes(p)), `${hook.id} and ${id} share no platform`).toBe(true);
      }
    }
  });

  it("keeps photo ranges, cues and hashtags well formed", () => {
    for (const f of formats) {
      expect(f.minPhotos).toBeGreaterThanOrEqual(1);
      expect(f.maxPhotos).toBeGreaterThanOrEqual(f.minPhotos);
      if (f.media === "single") expect(f.maxPhotos).toBe(1);
      if (f.media === "carousel") expect(f.minPhotos).toBeGreaterThanOrEqual(2);
      expect(f.cues.every((c) => c === c.toLowerCase())).toBe(true);
    }
    for (const h of hashtags) expect(h.tag).toMatch(/^#[A-Za-z0-9_]+$/);
  });

  it("gives every niche enough to write from on every platform", () => {
    for (const niche of NICHES) {
      const mine = playbookForNiche(PLAYBOOK_SEED, niche);
      for (const platform of POST_PLATFORMS) {
        expect(mine.formats.filter((f) => f.platforms.includes(platform)).length, `${niche} ${platform} formats`).toBeGreaterThanOrEqual(5);
        expect(mine.hooks.filter((h) => h.platforms.includes(platform)).length, `${niche} ${platform} hooks`).toBeGreaterThanOrEqual(8);
        expect(hashtagsFor(mine, niche, platform, "", "").length, `${niche} ${platform} hashtags`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("uses no dashes the style guide forbids", () => {
    expect(JSON.stringify(PLAYBOOK_SEED)).not.toMatch(/[–—]/);
  });
});

describe("pickFormats", () => {
  it("ranks before and after first for a home job described that way", () => {
    const picked = pickFormats(PLAYBOOK_SEED, { niche: "home", platform: "instagram", photoCount: 3, description: "Before and after of a furnace replacement in College Park" });
    expect(picked[0]?.id).toBe("before-after");
  });

  it("leaves out formats that can't hold the photo count", () => {
    const picked = pickFormats(PLAYBOOK_SEED, { niche: "home", platform: "instagram", photoCount: 1, description: "Before and after" });
    expect(picked.map((f) => f.id)).not.toContain("before-after");
    expect(picked.every((f) => f.minPhotos <= 1)).toBe(true);
  });

  it("matches cues as whole words, so 'work' doesn't count as 'or'", () => {
    const picked = pickFormats(PLAYBOOK_SEED, { niche: "restaurant", platform: "instagram", photoCount: 2, description: "Our work this week" });
    expect(picked[0]?.id).not.toBe("this-or-that");
  });

  it("keeps formats to their niches and platforms", () => {
    const picked = pickFormats(PLAYBOOK_SEED, { niche: "restaurant", platform: "linkedin", photoCount: 1, description: "new dish" });
    expect(picked.map((f) => f.id)).not.toContain("dish-spotlight");
    expect(picked.every((f) => f.platforms.includes("linkedin") && (f.niches.includes("restaurant") || f.niches.includes("any")))).toBe(true);
  });

  it("finds community impact for a nonprofit's class photos", () => {
    const picked = pickFormats(PLAYBOOK_SEED, { niche: "any", platform: "linkedin", photoCount: 4, description: "Students at our weekend STEM workshop built solar ovens" });
    expect(picked[0]?.id).toBe("community-impact");
  });
});

describe("hooksFor", () => {
  it("lists the format's own hooks before general ones", () => {
    const list = hooksFor(PLAYBOOK_SEED, "before-after", "instagram", "home");
    expect(list[0]?.formats).toContain("before-after");
    expect(list.some((h) => h.formats.length === 0)).toBe(true);
    expect(list.every((h) => h.platforms.includes("instagram"))).toBe(true);
  });
});

describe("hashtags", () => {
  it("makes a local tag from the city", () => {
    expect(localTag("College Park, MD")).toBe("#CollegePark");
    expect(localTag("Fremont, California")).toBe("#Fremont");
    expect(localTag("")).toBeNull();
  });

  it("puts the local tag and trade tags first", () => {
    const list = hashtagsFor(PLAYBOOK_SEED, "home", "instagram", "HVAC", "College Park, MD");
    expect(list[0]).toBe("#CollegePark");
    expect(list.slice(1, 3)).toContain("#HVAC");
    expect(list).not.toContain("#Plumbing");
  });

  it("accepts a caption that uses offered tags within the limits", () => {
    const allowed = hashtagsFor(PLAYBOOK_SEED, "home", "linkedin", "HVAC", "College Park, MD");
    expect(checkHashtags("New furnace in.\n\n#HVAC #CollegePark #SmallBusiness", "linkedin", allowed)).toBeNull();
  });

  it("refuses too few, too many or made-up hashtags", () => {
    const allowed = hashtagsFor(PLAYBOOK_SEED, "home", "instagram", "HVAC", "College Park, MD");
    expect(checkHashtags("Done. #HVAC", "instagram", allowed)).toMatch(/at least 3/);
    expect(checkHashtags(`Done. ${allowed.slice(0, 9).join(" ")}`, "instagram", allowed)).toMatch(/at most 8/);
    expect(checkHashtags("Done. #HVAC #CollegePark #BestInTown", "instagram", allowed)).toMatch(/#BestInTown/);
  });
});
