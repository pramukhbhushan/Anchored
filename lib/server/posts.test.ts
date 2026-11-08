import { describe, expect, it, vi } from "vitest";
import { profileFromFacts } from "@/lib/domain/engine";
import { PLAYBOOK_SEED } from "@/lib/domain/playbook-seed";
import type { LlmProvider } from "@/lib/llm";
import { writePost } from "./posts";

const hvac = profileFromFacts({ name: "College Park Heating & Air", trade: "HVAC", tradeKey: "home", place: "College Park, MD", reach: ["Phone calls"], tools: [], signals: [] });
const photos = [1, 2, 3].map((n) => ({ id: `p${n}`, url: `/p/${n}` }));
const description = "Before and after of a furnace replacement";

const GOOD = {
  instagram: "Same basement. One day apart.\n\nBefore and after of a furnace replacement in College Park.\n\nSend us a message to book yours.\n\n#CollegePark #HVAC #Furnace #BeforeAndAfter",
  facebook: "Hey College Park, quick look at a furnace replacement we just finished.\n\nMessage us with any questions.\n\n#CollegePark #HVAC",
  linkedin: "What one job taught our team about doing it right:\n\nA furnace replacement, from the old unit out to the new one running.\n\nProud of the crew.\n\n#HVAC #SmallBusiness #CollegePark",
  slides: ["The old furnace", "Out with the old", "New furnace running"],
};

/** A fake model that answers `generateObject` with `answer`, or throws it when it's an Error. */
function fakeLlm(answer: unknown): LlmProvider {
  return {
    name: "anthropic",
    label: "Fake",
    modelFor: () => "fake",
    generateText: vi.fn(),
    generateObject: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  } as unknown as LlmProvider;
}

/** A fake model that writes `draft` and reviews it into `review`, or throws either when it's an Error. */
function writerAndReviewer(draft: unknown, review: unknown): LlmProvider {
  return {
    name: "anthropic",
    label: "Fake",
    modelFor: () => "fake",
    generateText: vi.fn(),
    generateObject: vi.fn(async ({ schemaName }: { schemaName: string }) => {
      const answer = schemaName === "post_review" ? review : draft;
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  } as unknown as LlmProvider;
}

/** The tester's brief from the Nov 8 run: facts about the event mixed with how to write it. */
const MIXED_BRIEF =
  "Marketing test: make a carousel caption about a classroom event. These three photos show a projected presentation, attendees seated with laptops, and a wide view of the room. The goal is to share an event recap. Use a warm, factual tone. Do not identify attendees or invent the event name, date, organizer, or a connection to Maple Street Café. Draft only.";

describe("writePost", () => {
  it("keeps the model's captions and slides when every check passes", async () => {
    const post = await writePost(fakeLlm(GOOD), PLAYBOOK_SEED, hvac, description, photos);
    expect(post.written).toEqual({ instagram: "ai", facebook: "ai", linkedin: "ai" });
    expect(post.captions.instagram).toBe(GOOD.instagram);
    expect(post.slides).toEqual(GOOD.slides);
    expect(post.formats.instagram).toEqual({ id: "before-after", name: "Before and after" });
    expect(post.photos).toEqual(photos);
  });

  it("swaps only the failing caption for the template", async () => {
    const answer = { ...GOOD, facebook: "New furnace for just $4,999! Call 301-555-0100. #CollegePark #HVAC" };
    const post = await writePost(fakeLlm(answer), PLAYBOOK_SEED, hvac, description, photos);
    expect(post.written).toEqual({ instagram: "ai", facebook: "template", linkedin: "ai" });
    expect(post.captions.facebook).not.toContain("$4,999");
  });

  it.each([
    ["a hashtag nobody offered", { linkedin: "A furnace replacement. #HVAC #CollegePark #BestHVACEver" }],
    ["too few hashtags", { linkedin: "A furnace replacement. #HVAC" }],
    ["an unfilled hook blank", { linkedin: "{The project} taught me a lot. #HVAC #CollegePark #SmallBusiness" }],
    ["a machine-sounding phrase", { linkedin: "This furnace is a testament to our crew. #HVAC #CollegePark #SmallBusiness" }],
    ["an award the owner never mentioned", { linkedin: "Our award-winning crew did a furnace replacement. #HVAC #CollegePark #SmallBusiness" }],
  ])("refuses a caption with %s", async (_label, change) => {
    const post = await writePost(fakeLlm({ ...GOOD, ...change }), PLAYBOOK_SEED, hvac, description, photos);
    expect(post.written.linkedin).toBe("template");
  });

  it("gives the model a second try after a malformed reply", async () => {
    const llm = fakeLlm(GOOD);
    vi.mocked(llm.generateObject).mockRejectedValueOnce(new Error("not JSON"));
    const post = await writePost(llm, PLAYBOOK_SEED, hvac, description, photos);
    const writes = vi.mocked(llm.generateObject).mock.calls.filter(([request]) => request.schemaName === "post_captions");
    expect(writes).toHaveLength(2);
    expect(post.written.instagram).toBe("ai");
  });

  it("drops slides that don't match the photo count", async () => {
    const post = await writePost(fakeLlm({ ...GOOD, slides: ["Only one"] }), PLAYBOOK_SEED, hvac, description, photos);
    expect(post.slides).toEqual([]);
  });

  it("uses templates for everything when the model fails or isn't set up", async () => {
    for (const llm of [fakeLlm(new Error("timeout")), null]) {
      const post = await writePost(llm, PLAYBOOK_SEED, hvac, description, photos);
      expect(post.written).toEqual({ instagram: "template", facebook: "template", linkedin: "template" });
      expect(post.captions.instagram).toContain("#CollegePark");
    }
  });

  it("keeps the reviewer's fix when it passes every check", async () => {
    const reviewed = { instagram: "Out with the rusted furnace, in with the new one.\n\nA furnace replacement in College Park.\n\n#CollegePark #HVAC #Furnace", facebook: GOOD.facebook, linkedin: GOOD.linkedin };
    const llm = writerAndReviewer(GOOD, reviewed);
    const post = await writePost(llm, PLAYBOOK_SEED, hvac, description, photos);
    expect(post.captions.instagram).toBe(reviewed.instagram);
    expect(post.written.instagram).toBe("ai");
    const review = vi.mocked(llm.generateObject).mock.calls.find(([request]) => request.schemaName === "post_review")?.[0];
    expect(review?.tier).toBe("quick");
    expect(review?.prompt).toContain(GOOD.instagram);
  });

  it("keeps the draft when the reviewer's fix fails a check", async () => {
    const post = await writePost(writerAndReviewer(GOOD, { ...GOOD, linkedin: "A testament to our award-winning crew. #HVAC #CollegePark #SmallBusiness" }), PLAYBOOK_SEED, hvac, description, photos);
    expect(post.captions.linkedin).toBe(GOOD.linkedin);
    expect(post.written.linkedin).toBe("ai");
  });

  it("keeps the drafts when the review fails", async () => {
    const post = await writePost(writerAndReviewer(GOOD, new Error("cut off")), PLAYBOOK_SEED, hvac, description, photos);
    expect(post.captions).toEqual({ instagram: GOOD.instagram, facebook: GOOD.facebook, linkedin: GOOD.linkedin });
  });

  it("skips the review when no draft caption passed", async () => {
    const llm = fakeLlm(new Error("not JSON"));
    await writePost(llm, PLAYBOOK_SEED, hvac, description, photos);
    expect(vi.mocked(llm.generateObject).mock.calls.every(([request]) => request.schemaName === "post_captions")).toBe(true);
  });

  it("gives the writer the brief apart from the owner's requests, and the owner's saved voice", async () => {
    const llm = fakeLlm(GOOD);
    await writePost(llm, PLAYBOOK_SEED, { ...hvac, voice: "Short and friendly, we say folks a lot" }, MIXED_BRIEF, photos);
    const prompt = vi.mocked(llm.generateObject).mock.calls[0]![0].prompt;
    const about = /<post_about>\n([\s\S]*?)\n<\/post_about>/.exec(prompt)?.[1];
    expect(about).toBe("A classroom event. A projected presentation, attendees seated with laptops, and a wide view of the room.");
    expect(prompt).toMatch(/<owner_requests>[\s\S]*Use a warm, factual tone\.[\s\S]*<\/owner_requests>/);
    expect(prompt).toMatch(/<owner_voice>\nShort and friendly, we say folks a lot\n<\/owner_voice>/);
  });

  it("never copies the owner's instructions into a template caption", async () => {
    const post = await writePost(null, PLAYBOOK_SEED, hvac, MIXED_BRIEF, photos);
    for (const caption of Object.values(post.captions)) {
      expect(caption).toContain("A classroom event. A projected presentation, attendees seated with laptops, and a wide view of the room.");
      for (const instruction of ["Marketing test", "Draft only", "Do not identify", "warm, factual tone", "The goal is"]) expect(caption).not.toContain(instruction);
    }
  });
});
