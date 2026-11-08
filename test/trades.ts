import { profileFromFacts } from "@/lib/domain/engine";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Businesses an owner could create, built by the rules engine alone, so the
// trade-agnostic tests cover an HVAC shop and a career coach without any
// research on top. Test data only; nothing in the app imports this.

/** A six-person HVAC contractor on Jobber and QuickBooks, as the rules map it. */
export function hvacShop(): BusinessProfile {
  return profileFromFacts({
    id: "hvac",
    name: "College Park Heating & Air",
    trade: "HVAC contractor",
    tradeKey: "home",
    place: "College Park, MD",
    size: "6 people, 4 trucks",
    seats: 6,
    revenue: "About $1M a year",
    customers: "Homeowners within 20 miles",
    languages: ["English"],
    reach: ["Phone calls", "Website form", "Google"],
    tools: ["Jobber", "QuickBooks Online", "Google Business Profile", "Cell phone"],
    signals: ["quotes", "memberships"],
    tasks: ["Return missed calls between jobs", "Chase replacement quotes", "Ask for reviews"],
    voice: "Sorry we missed you, this is Dana at College Park Heating & Air.",
  });
}

/** A solo career coach on Calendly and Stripe, as the rules map it. */
export function careerCoach(): BusinessProfile {
  return profileFromFacts({
    id: "coach",
    name: "Northpoint Career Coaching",
    trade: "Career coach",
    tradeKey: "coach",
    place: "Rockville, MD, sessions online",
    size: "Solo",
    seats: 1,
    revenue: "$1,800 per 3-month package",
    customers: "Mid-career professionals changing fields",
    languages: ["English"],
    reach: ["Instagram or Facebook", "Referrals", "Website form"],
    tools: ["Calendly", "Stripe", "Google Sheets", "Gmail"],
    signals: ["appointments", "marketing"],
    tasks: ["Reply to DMs between sessions", "Discovery call no-shows", "Late invoices"],
    voice: "Hi! Thanks so much for reaching out.",
  });
}
