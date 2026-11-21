import type { Tool } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Pure helpers behind the Tools page's pictures: `fitBand` names the color band
// of a fit score, `monogram` and `nameHue` draw a tool's letter tile without a
// vendor logo, and `priceChip` shortens a tool's price to a few characters.

/** How a fit score reads at a glance: green, plain ink or orange. */
type FitBand = "good" | "fair" | "weak";

/** Plain words for each band, read out with the score. */
export const FIT_BAND_LABEL: Readonly<Record<FitBand, string>> = {
  good: "good fit",
  fair: "fair fit",
  weak: "weak fit",
};

// Checks we haven't verified count for little, so even a strong tool rarely clears 70 today; these cut points split
// the catalog's real spread (about 30 to 70) into thirds rather than promising an absolute grade.
/** Lowest score drawn as a good fit. */
export const FIT_GOOD_FROM = 60;
/** Lowest score drawn as a fair fit; below it the ring turns orange. */
export const FIT_FAIR_FROM = 45;

/** Return the band for a fit score out of 100. */
export function fitBand(total: number): FitBand {
  if (total >= FIT_GOOD_FROM) return "good";
  return total >= FIT_FAIR_FROM ? "fair" : "weak";
}

/** Return up to two capital letters for a tool's tile: the first letters of its first two words. */
export function monogram(name: string): string {
  const words = name.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word));
  const letters = words.slice(0, 2).map((word) => word.replace(/[^a-z0-9]/gi, "").charAt(0));
  return letters.join("").toUpperCase() || "?";
}

/** Return a hue from 0 to 359 that stays the same for the same name, so a tool keeps its color. */
export function nameHue(name: string): number {
  let hash = 0;
  // A small string hash; the hue only has to be stable and spread out, not secure.
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/** Return the short price for a tool's chip, such as "$17/mo", "$250/user/mo", "Free to start" or "On quote". */
export function priceChip(tool: Pick<Tool, "monthly" | "perUser">): string {
  if (tool.monthly === null) return "On quote";
  // A $0 typical cost still often hides paid plans or per-order fees, which the full price text spells out.
  if (tool.monthly === 0) return "Free to start";
  const digits = Number.isInteger(tool.monthly) ? 0 : 2;
  const amount = tool.monthly.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return tool.perUser ? `$${amount}/user/mo` : `$${amount}/mo`;
}
