import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "@/lib/api/contract";
import { approvedDraft, copyTextFor, handOff, type ApprovedDraft, type HandOffBusiness } from "./handoff";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's send step for each kind of approved draft. A text or an email
// opens the owner's own app with the words typed out; a post, a review reply or
// a text to many people is copied, with links to where it gets pasted; a list
// that stays inside Anchored, such as the rep list, has no send step.

const SHOP: HandOffBusiness = { name: "Rivera Heating & Air", reach: ["Phone calls", "Google", "Instagram or Facebook"], tools: [] };
const COACH: HandOffBusiness = { name: "Clear Path Coaching", reach: ["Referrals", "Email"], tools: [] };

const TEXT: ApprovedDraft = {
  channel: "sms",
  to: "Dana Lewis",
  body: "Hi Dana, checking in on the quote. Reply STOP to opt out.",
  title: "Quote to the Lewis family, 5 days quiet",
  action: "Send text",
};

/** Return the query value `name` from a hand-off link. */
function param(href: string, name: string): string | null {
  return new URLSearchParams(href.slice(href.indexOf("?") + 1)).get(name);
}

describe("handOff", () => {
  it("opens the texting app with the words typed out, leaving a named customer for the owner to pick", () => {
    const step = handOff(TEXT, SHOP);

    expect(step).toMatchObject({ kind: "open", label: "Send from your phone" });
    if (step?.kind !== "open") throw new Error("expected a link");
    expect(step.href.startsWith("sms:?")).toBe(true);
    expect(param(step.href, "body")).toBe(TEXT.body);
  });

  it("addresses the text when the recipient is a phone number, such as a missed caller", () => {
    const step = handOff({ ...TEXT, to: "(410) 555-0137" }, SHOP);

    if (step?.kind !== "open") throw new Error("expected a link");
    expect(step.href.startsWith("sms:4105550137?")).toBe(true);
  });

  it("keeps every character of the words, including ones a link treats as special", () => {
    const body = "Hi Sam & Jo, 50% off? No: #1 pick = us. Reply STOP to opt out.";
    const step = handOff({ ...TEXT, body }, SHOP);

    if (step?.kind !== "open") throw new Error("expected a link");
    expect(param(step.href, "body")).toBe(body);
    expect(step.href).not.toContain("#");
  });

  it("copies a text to many people for a texting service instead of opening the phone's own app", () => {
    const step = handOff({ ...TEXT, to: "38 customers with consent", action: "Send to 38 customers" }, SHOP);

    expect(step).toEqual({ kind: "copy", what: "text", text: TEXT.body, hint: "Paste it into the texting service that keeps your customer list.", places: [] });
  });

  it("opens the email app with the words and a subject naming the business", () => {
    const step = handOff({ channel: "email", to: "Sam Patel", body: "Hi Sam, could we talk tomorrow?", title: "New inquiry from Sam", action: "Send email" }, SHOP);

    expect(step).toMatchObject({ kind: "open", label: "Send from your email" });
    if (step?.kind !== "open") throw new Error("expected a link");
    expect(step.href.startsWith("mailto:?")).toBe(true);
    expect(param(step.href, "subject")).toBe("A note from Rivera Heating & Air");
    expect(param(step.href, "body")).toBe("Hi Sam, could we talk tomorrow?");
  });

  it("addresses the email when the recipient is an email address", () => {
    const step = handOff({ channel: "email", to: "sam@example.com", body: "Hi Sam", title: "", action: "Send email" }, SHOP);

    if (step?.kind !== "open") throw new Error("expected a link");
    expect(step.href.startsWith("mailto:sam%40example.com?")).toBe(true);
  });

  it("copies only a post's words and lists Google first for a Google listing post", () => {
    const post: ApprovedDraft = {
      channel: "list",
      to: "customer",
      body: 'Draft post for Rivera Heating & Air: "Taking new bookings this month. Send us a message to find a time."',
      title: "Your Google listing hasn't changed in 3 months",
      action: "Copy post",
    };

    expect(handOff(post, SHOP)).toEqual({
      kind: "copy",
      what: "post",
      text: "Taking new bookings this month. Send us a message to find a time.",
      hint: "Paste it into a new post.",
      places: [
        { label: "Open your Google listing", href: "https://business.google.com/" },
        { label: "Open Instagram", href: "https://www.instagram.com/" },
        { label: "Open Facebook", href: "https://www.facebook.com/" },
      ],
    });
  });

  it("lists social media first for a post that isn't for Google, and only the places the owner uses", () => {
    const post: ApprovedDraft = { channel: "list", to: "customer", body: 'Draft post: "Thanks to everyone we worked with this week."', title: "Nothing posted in 3 weeks", action: "Copy post" };

    const shop = handOff(post, SHOP);
    const coach = handOff(post, COACH);

    expect(shop?.kind === "copy" && shop.places.map((place) => place.label)).toEqual(["Open Instagram", "Open Facebook", "Open your Google listing"]);
    expect(coach).toMatchObject({ kind: "copy", text: "Thanks to everyone we worked with this week.", places: [] });
  });

  it("points a review reply to Google when the business uses Google", () => {
    const reply: ApprovedDraft = { channel: "list", to: "customer", body: "Thanks, Chris.", title: "New 4-star review", action: "Copy reply" };

    expect(handOff(reply, SHOP)).toMatchObject({ kind: "copy", what: "reply", text: "Thanks, Chris.", places: [{ label: "Open your Google listing" }] });
    expect(handOff(reply, COACH)).toMatchObject({ kind: "copy", places: [] });
  });

  it("gives a list that stays inside Anchored, such as the rep list, no send step", () => {
    const rep: ApprovedDraft = { channel: "list", to: "customer", body: "Add it to your list for the rep?", title: "Price went up", action: "Add to rep list" };

    expect(handOff(rep, SHOP)).toBeNull();
  });
});

describe("copyTextFor", () => {
  it("keeps an edited post whole when the owner dropped the lead-in", () => {
    expect(copyTextFor("Copy post", "  Open late Friday!  ")).toBe("Open late Friday!");
  });
});

describe("approvedDraft", () => {
  const entry: OutboxEntry = { id: "o1", businessId: "b1", cardId: "c1", channel: "list", to: "customer", body: "Copy post: Draft post: \"Hi\"", sentAt: "2026-11-07T15:00:00Z", delivery: "yours", note: null };

  it("reads a list entry's words from its card, since the outbox logs the action in front", () => {
    expect(approvedDraft(entry, { body: 'Draft post: "Hi"', title: "A short post", action: "Copy post" })).toEqual({
      channel: "list",
      to: "customer",
      body: 'Draft post: "Hi"',
      title: "A short post",
      action: "Copy post",
    });
  });

  it("drops a list entry whose card left the feed, and keeps a text whose card did", () => {
    expect(approvedDraft(entry, undefined)).toBeNull();
    expect(approvedDraft({ ...entry, channel: "sms", body: "Hi" }, undefined)).toMatchObject({ channel: "sms", body: "Hi", action: "" });
  });
});
