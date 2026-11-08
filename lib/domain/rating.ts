import { fitsTrade, normalizeName } from "@/lib/domain/catalog";
import type { BusinessProfile, Check, CheckKey, CheckStatus, Evidence, Rating, Tool } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Rates a catalog tool for one business on the seven checks from
// docs/research/corner-stores-and-restaurants-notes/tools_by_job.md. `rateTool` personalizes the connects, languages and proven
// checks from the business's software, languages and trade, then weighs all
// seven into a 0 to 100 `total`. `usesSoftware` is the shared name match.

/** One of the seven checks and its display label. */
export interface CheckDef {
  readonly key: CheckKey;
  readonly label: string;
}

/** What `rateTool` reads from a business. */
export type RatingContext = Pick<BusinessProfile, "tools" | "tradeKey" | "languages">;

// =============================================================================
// Labels
// =============================================================================

/** The seven checks, in display and scoring order. */
export const CHECKS: readonly CheckDef[] = [
  { key: "connects", label: "Connects to your software" },
  { key: "price", label: "Price and cancel terms published" },
  { key: "charge", label: "You stay in charge" },
  { key: "data", label: "States data use" },
  { key: "start", label: "Easy to start" },
  { key: "langs", label: "Names your languages" },
  { key: "proven", label: "Proven in similar businesses" },
];

/** Plain-words label for each evidence level. */
export const EVIDENCE_LABEL: Readonly<Record<Evidence, string>> = {
  // The date lives on each tool's `checkedOn`, shown beside its source, so one fixed month can't go stale here.
  page: "Vendor page",
  snippet: "Search summary only",
  third: "Third-party page",
  ours: "Our reading of how it works",
  none: "Not stated on the pages read",
  unchecked: "Not checked yet",
  pilot: "Needs pilot data",
};

/** Plain-words label for each check status. */
export const STATUS_LABEL: Readonly<Record<CheckStatus, string>> = {
  met: "Met",
  partly: "Partly",
  unknown: "Not known yet",
  no: "Not met",
};

// =============================================================================
// Scoring weights
// =============================================================================

// An unknown check scores a little above "no" so an unread page doesn't sink a tool.
const STATUS_VALUE: Readonly<Record<CheckStatus, number>> = { met: 1, partly: 0.5, unknown: 0.25, no: 0 };

/** Weight of each check; languages weigh more when the business serves customers in a language besides English. */
function checkWeights(servesOtherLanguages: boolean): Readonly<Record<CheckKey, number>> {
  return { connects: 25, price: 20, charge: 15, data: 15, start: 10, proven: 10, langs: servesOtherLanguages ? 15 : 5 };
}

const NO_SETUP_TIME: Check = ["unknown", "pilot", "No vendor publishes a setup time. A timed pilot setup will settle it"];

// =============================================================================
// Rating
// =============================================================================

/** Whether the business uses software called `name`, matching loosely so "QuickBooks" finds "QuickBooks Online". */
export function usesSoftware(business: Pick<BusinessProfile, "tools">, name: string): boolean {
  const wanted = normalizeName(name);
  return business.tools.some((tool) => {
    const owned = normalizeName(tool);
    // Substring match both ways; an empty name would match everything, so it never counts.
    return owned !== "" && wanted !== "" && (owned.includes(wanted) || wanted.includes(owned));
  });
}

/** Rate `tool` for one business: seven checks, each with a status and an evidence level, and a weighted total. */
export function rateTool(tool: Tool, business: RatingContext): Rating {
  const otherLanguages = business.languages.filter((language) => language !== "English");
  const checks: Readonly<Record<CheckKey, Check>> = {
    connects: connectsCheck(tool, business),
    price: tool.checks.price,
    charge: tool.checks.charge,
    data: tool.checks.data,
    start: tool.checks.start ?? NO_SETUP_TIME,
    langs: languagesCheck(tool, otherLanguages),
    proven: provenCheck(tool, business),
  };
  const weight = checkWeights(otherLanguages.length > 0);
  let earned = 0;
  let possible = 0;
  for (const { key } of CHECKS) {
    earned += weight[key] * STATUS_VALUE[checks[key][0]];
    possible += weight[key];
  }
  return {
    total: Math.round((100 * earned) / possible),
    checks,
    met: CHECKS.filter(({ key }) => checks[key][0] === "met").length,
    unknown: CHECKS.filter(({ key }) => checks[key][0] === "unknown").length,
  };
}

// -----------------------------------------------------------------
// Personalized checks
// -----------------------------------------------------------------

/** A platform tool needs its platform; otherwise any named integration the business uses counts. */
function connectsCheck(tool: Tool, business: RatingContext): Check {
  if (tool.platform !== undefined) {
    return usesSoftware(business, tool.platform)
      ? ["met", "ours", `Part of ${tool.platform}, which you use`]
      : ["no", "ours", `Needs ${tool.platform}, which isn't in the tools you named`];
  }
  if (tool.connects === undefined || tool.connects.length === 0) {
    return ["unknown", "none", "Doesn't name the software it works with"];
  }
  const hit = tool.connects.find((name) => usesSoftware(business, name));
  return hit !== undefined
    ? ["met", "page", `Works with ${hit}, which you use`]
    : ["no", "page", `Names ${tool.connects.slice(0, 4).join(", ")}. None is in your setup`];
}

/** Met when the tool names every language the business serves besides English. */
function languagesCheck(tool: Tool, otherLanguages: readonly string[]): Check {
  const named = tool.languages;
  if (named === undefined) return ["unknown", "none", tool.languageNote ?? "Languages not named"];
  if (otherLanguages.length === 0) return ["met", "page", `Names ${named.join(", ")}`];
  const missing = otherLanguages.filter((language) => !named.includes(language));
  return missing.length > 0
    ? ["no", "page", `Doesn't name ${missing.join(" or ")}`]
    : ["met", "page", `Names ${otherLanguages.join(" and ")}`];
}

/** No tool has published 30-day results yet, so the best a fitting tool gets is "needs pilot data". */
function provenCheck(tool: Tool, business: RatingContext): Check {
  if (!fitsTrade(tool, business.tradeKey)) return ["no", "ours", `Built for ${tool.for.join(" and ")} businesses`];
  // A general tool fits through "any", which says nothing about this trade in particular.
  return tool.for.includes(business.tradeKey)
    ? ["unknown", "pilot", "Built for businesses like yours. No 30-day results published yet"]
    : ["unknown", "pilot", "Sold to any kind of business. No 30-day results published yet"];
}
