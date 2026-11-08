import "server-only";

// =============================================================================
// Module Overview
// =============================================================================
// Loads one public web page and returns its title and readable text, for the
// discovery agent to confirm that a tool's own site exists and names it. Only
// `npm run discover` calls it; no route does, so a visitor can never make the
// server fetch an address. It still refuses local and private addresses, non-HTML
// replies and oversized pages, and gives up after a timeout.

/** A page as the discovery agent reads it. `url` is the address after redirects. */
export interface FetchedPage {
  readonly url: string;
  readonly title: string;
  readonly text: string;
}

/** Limits for one fetch; tests shrink them. */
export interface FetchOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly maxChars?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
// About 2,000 words: enough for a pricing page, small enough to send several to a model at once.
const DEFAULT_MAX_CHARS = 12_000;

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Whether `host` names this machine or a private network, which the agent must never load. */
export function isPrivateHost(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local") || name.endsWith(".internal")) return true;
  // Vendor sites have names; an IPv6 literal or a bare single-label name is never one of them.
  if (name.includes(":") || !name.includes(".")) return true;
  const octets = name.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = octets as [number, number, number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Whether `url` is a public http or https address on the default port. */
export function isPublicWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.port === "" && parsed.username === "" && !isPrivateHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** Decode the few HTML entities that matter for reading prices and names. */
function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (whole, code: string) => {
    const lower = code.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower] ?? whole;
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return whole;
  });
}

/** The page's title and visible text, with scripts, styles and tags removed and whitespace collapsed. */
export function readableText(html: string): { title: string; text: string } {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|template|title)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(`${description} ${body}`).replace(/\s+/g, " ").trim();
  return { title, text };
}

/** Load `url` and return its readable text, or `null` when it is private, fails, isn't HTML or is too large. */
export async function fetchPage(url: string, options: FetchOptions = {}): Promise<FetchedPage | null> {
  if (!isPublicWebUrl(url)) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: { accept: "text/html", "user-agent": "AnchoredDiscovery/1.0 (tool catalog review)" },
    });
    // A redirect can land anywhere, so the final address must pass the same check.
    const finalUrl = response.url || url;
    if (!response.ok || !isPublicWebUrl(finalUrl)) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    const declared = Number(response.headers.get("content-length") ?? "0");
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    if (declared > maxBytes) return null;
    const html = await response.text();
    if (html.length > maxBytes) return null;
    const { title, text } = readableText(html);
    if (text === "") return null;
    return { url: finalUrl, title: title || new URL(finalUrl).hostname, text: text.slice(0, options.maxChars ?? DEFAULT_MAX_CHARS) };
  } catch {
    // Timeouts, refused connections and bad TLS all mean the same thing here: no page to read.
    return null;
  }
}
