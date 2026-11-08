import { DISCOVERY_QUEUE, TOOLS, normalizeName, toolName } from "@/lib/domain/catalog";
import type { DiscoveryListing, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The rules a discovered tool must pass before it joins the queue. The model
// reads web pages and names tools; `vetCandidates` keeps a tool only when its
// source is a page the search really returned, its name appears in the
// research, and Anchored doesn't already list it. Code sets the workflow and
// the date, and nothing here scores a tool: a person checks it first.

/** One tool as the model described it. `source` numbers a page in the search results, starting at 1. */
export interface DiscoveryCandidate {
  readonly name: string;
  readonly maker: string;
  readonly source: number;
  readonly price: string;
  readonly connects: string;
  readonly contract: string;
  readonly data: string;
}

/** A page the search returned. */
export interface SearchedPage {
  readonly url: string;
  readonly title: string;
}

/** What one discovery run found for one workflow. */
export interface DiscoveryInput {
  readonly candidates: readonly DiscoveryCandidate[];
  readonly pages: readonly SearchedPage[];
  /** The research text the candidates were drawn from. */
  readonly findings: string;
  readonly workflow: WorkflowId;
  /** The date to stamp on each listing, such as "Nov 8, 2026". */
  readonly foundOn: string;
  /** Names already listed. Defaults to every catalog tool and queued listing. */
  readonly known?: readonly string[];
}

/** One candidate the rules turned away, and why, in plain words. */
export interface SkippedCandidate {
  readonly name: string;
  readonly reason: string;
}

/** The listings that passed and the candidates that didn't. */
export interface DiscoveryResult {
  readonly listings: readonly DiscoveryListing[];
  readonly skipped: readonly SkippedCandidate[];
}

/** Most listings one run may add, so a single search can't flood the queue. */
export const MAX_LISTINGS_PER_RUN = 8;

const NAME_MAX = 60;
const FIELD_MAX = 160;
const LABEL_MAX = 60;
const NOT_STATED = "Not stated";

/** Every tool name Anchored already lists, in the catalog or the queue, with and without the maker. */
export function knownToolNames(): string[] {
  return [...TOOLS.flatMap((tool) => [tool.name, toolName(tool)]), ...DISCOVERY_QUEUE.map((listing) => listing.name)];
}

/** Collapse whitespace and cap the length; an empty answer becomes "Not stated". */
function cleanField(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text === "") return NOT_STATED;
  return text.length > FIELD_MAX ? `${text.slice(0, FIELD_MAX - 1).trimEnd()}…` : text;
}

/** A short label for a page: its address without the scheme, "www.", query or trailing slash. */
export function sourceLabel(url: string): string {
  const parsed = new URL(url);
  const label = `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}`.replace(/\/+$/, "");
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
}

/** The page `source` points at, or `undefined` when the number is outside the list or the address isn't a web page. */
function pageFor(source: number, pages: readonly SearchedPage[]): SearchedPage | undefined {
  if (!Number.isInteger(source)) return undefined;
  const page = pages[source - 1];
  if (page === undefined) return undefined;
  try {
    const { protocol } = new URL(page.url);
    return protocol === "https:" || protocol === "http:" ? page : undefined;
  } catch {
    return undefined;
  }
}

/** Keep the candidates that pass every rule, up to `MAX_LISTINGS_PER_RUN`, and say why each other one was skipped. */
export function vetCandidates(input: DiscoveryInput): DiscoveryResult {
  const seen = new Set((input.known ?? knownToolNames()).map(normalizeName).filter((name) => name !== ""));
  const research = normalizeName(input.findings);
  const listings: DiscoveryListing[] = [];
  const skipped: SkippedCandidate[] = [];

  for (const candidate of input.candidates) {
    const product = candidate.name.replace(/\s+/g, " ").trim();
    const maker = candidate.maker.replace(/\s+/g, " ").trim();
    const productKey = normalizeName(product);
    // Name it the way `toolName` does: maker in front unless the product name already says it.
    const name = normalizeName(maker) !== "" && !productKey.includes(normalizeName(maker)) ? `${maker} ${product}` : product;
    const key = normalizeName(name);
    const skip = (reason: string) => skipped.push({ name: name || "(no name)", reason });

    if (productKey === "" || name.length > NAME_MAX || /https?:|www\./i.test(name)) {
      skip("The name isn't a product name");
      continue;
    }
    if (seen.has(key) || seen.has(productKey)) {
      skip("Anchored already lists it");
      continue;
    }
    // The extraction step may only name tools the search step wrote about.
    if (!research.includes(productKey)) {
      skip("The research never mentions it");
      continue;
    }
    const page = pageFor(candidate.source, input.pages);
    if (page === undefined) {
      skip("Its source isn't a page the search returned");
      continue;
    }
    if (listings.length >= MAX_LISTINGS_PER_RUN) {
      skip(`This run already added ${MAX_LISTINGS_PER_RUN}`);
      continue;
    }
    seen.add(key);
    seen.add(productKey);
    listings.push({
      name,
      workflow: input.workflow,
      price: cleanField(candidate.price),
      connects: cleanField(candidate.connects),
      data: cleanField(candidate.data),
      contract: cleanField(candidate.contract),
      source: sourceLabel(page.url),
      url: page.url,
      foundOn: input.foundOn,
    });
  }
  return { listings, skipped };
}
