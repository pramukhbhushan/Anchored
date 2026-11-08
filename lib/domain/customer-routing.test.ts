import { describe, expect, it } from "vitest";
import type { SkillId } from "@/lib/domain/types";
import { asksAboutBilling, routeCustomerMessage, type ThreadCard } from "./customer-routing";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of Customer routing: a bill question goes to Bookkeeping, an open
// quote to Closer, a booking to Show-up Keeper, catering to Catering Responder
// and anything else to Inquiry, only among the skills the business chose, and
// a message no chosen skill answers goes to the owner.

const ALL = new Set<SkillId>(["inquiry", "closer", "showup", "catering"]);
const card = (skill: SkillId, status: ThreadCard["status"] = "approved"): ThreadCard => ({ skill, status });

describe("routeCustomerMessage", () => {
  it("sends an ordinary question to Inquiry", () => {
    expect(routeCustomerMessage("Do you do weekend tune-ups?", ALL, [])).toEqual({ kind: "skill", skill: "inquiry" });
  });

  it("sends a price question to Inquiry, not Bookkeeping", () => {
    expect(routeCustomerMessage("What do you charge for a furnace check?", ALL, [])).toEqual({ kind: "skill", skill: "inquiry" });
  });

  it("sends a bill question to Bookkeeping before anything else", () => {
    expect(routeCustomerMessage("I think you charged me twice on the last invoice", ALL, [card("closer")])).toEqual({ kind: "billing" });
  });

  it("follows the customer's open quote, then their booking, by what is on record", () => {
    expect(routeCustomerMessage("Still thinking it over", ALL, [card("showup"), card("closer", "pending")])).toEqual({ kind: "skill", skill: "closer" });
    expect(routeCustomerMessage("Running 10 minutes late", ALL, [card("showup")])).toEqual({ kind: "skill", skill: "showup" });
  });

  it("ignores skipped and replaced cards", () => {
    expect(routeCustomerMessage("Hello again", ALL, [card("closer", "skipped"), card("showup", "superseded")])).toEqual({ kind: "skill", skill: "inquiry" });
  });

  it("sends a catering request to Catering, from the record or the message itself", () => {
    expect(routeCustomerMessage("Can you cater a party of 40?", ALL, [])).toEqual({ kind: "skill", skill: "catering" });
    expect(routeCustomerMessage("Food for 25 people next month?", ALL, [])).toEqual({ kind: "skill", skill: "catering" });
    expect(routeCustomerMessage("Saturday works", ALL, [card("catering", "pending")])).toEqual({ kind: "skill", skill: "catering" });
  });

  it("answers only with skills the business chose", () => {
    expect(routeCustomerMessage("Can you cater a party of 40?", new Set<SkillId>(["inquiry"]), [])).toEqual({ kind: "skill", skill: "inquiry" });
    expect(routeCustomerMessage("Still thinking it over", new Set<SkillId>(["inquiry"]), [card("closer")])).toEqual({ kind: "skill", skill: "inquiry" });
  });

  it("hands the message to the owner when no chosen skill answers customers", () => {
    expect(routeCustomerMessage("Hello?", new Set<SkillId>(["posts", "nudger"]), [])).toEqual({ kind: "owner" });
  });
});

describe("asksAboutBilling", () => {
  it("reads bills, invoices, payments and refunds, but not prices", () => {
    for (const text of ["Where's my receipt?", "Can I pay by card?", "I already paid", "Refund please", "What's my balance"]) expect(asksAboutBilling(text)).toBe(true);
    for (const text of ["How much is a tune-up?", "What do you charge?", "Are you open Sunday?"]) expect(asksAboutBilling(text)).toBe(false);
  });
});
