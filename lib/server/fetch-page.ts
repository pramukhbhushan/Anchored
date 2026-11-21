import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// =============================================================================
// Module Overview
// =============================================================================
// Loads one public web page and returns its title and readable text. A public
// route reaches it: `POST /api/businesses` with `from: "answers"` loads the
// owner's website. `npm run discover` also uses it to confirm that a tool's
// own site exists and names it. A visitor can pick the
// address, so every request passes a guard first: an http or https URL on the
// default port with no credentials, a host name that isn't local, single-label or
// an IPv6 literal, and a DNS answer whose every address is public. It follows at
// most three redirects by hand, and each hop passes the same guard before it is
// requested. It also refuses non-HTML replies and oversized pages, and gives up
// after a timeout.

/** A page as a caller reads it. `url` is the address after redirects. */
interface FetchedPage {
  readonly url: string;
  readonly title: string;
  readonly text: string;
}

/** One resolved address, in the shape `dns.lookup` returns with `all: true`. */
interface ResolvedAddress {
  readonly address: string;
  readonly family: number;
}

/** Resolves a host name to every address it has. */
export type ResolveHost = (hostname: string) => Promise<readonly ResolvedAddress[]>;

/** Limits for one fetch; tests shrink them and stand in for `fetch` and DNS. */
interface FetchOptions {
  readonly fetchImpl?: typeof fetch;
  readonly resolveHost?: ResolveHost;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly maxChars?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
// About 2,000 words: enough for a pricing page, small enough to send several to a model at once.
const DEFAULT_MAX_CHARS = 12_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

const defaultResolveHost: ResolveHost = (hostname) => lookup(hostname, { all: true });

// Addresses a public web server never has: this host, private and carrier networks,
// documentation, benchmarking, multicast and reserved space. BlockList checks an IPv4
// address mapped into IPv6, such as ::ffff:127.0.0.1, against these IPv4 rules too.
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
// Inside global unicast, the protocol and Teredo, documentation and 6to4 ranges are still refused.
for (const [network, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}
// Only 2000::/3 is public IPv6, so everything outside it is refused: ::, ::1, mapped
// IPv4 (::ffff:0:0/96), NAT64 (64:ff9b::/96), fc00::/7, fe80::/10 and ff00::/8 among them.
const GLOBAL_IPV6 = new BlockList();
GLOBAL_IPV6.addSubnet("2000::", 3, "ipv6");

/** Whether `host` names this machine or a private network, which the agent must never load. */
function isPrivateHost(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local") || name.endsWith(".internal")) return true;
  // Vendor sites have names; an IPv6 literal or a bare single-label name is never one of them.
  if (name.includes(":") || !name.includes(".")) return true;
  const octets = name.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = octets as [number, number, number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Whether a resolved IP address belongs to the public internet. */
export function isPublicAddress(address: string): boolean {
  // A zone id, as in fe80::1%en0, only appears on a link-local address.
  if (address.includes("%")) return false;
  switch (isIP(address)) {
    case 4:
      return !BLOCKED.check(address, "ipv4");
    case 6:
      return GLOBAL_IPV6.check(address, "ipv6") && !BLOCKED.check(address, "ipv6");
    default:
      return false;
  }
}

/** Whether `url` is a public http or https address on the default port, judged by its text alone. */
export function isPublicWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.port === "" && parsed.username === "" && !isPrivateHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** Whether `url` passes the text check and its host resolves only to public addresses. */
async function isSafeToRequest(url: string, resolveHost: ResolveHost): Promise<boolean> {
  if (!isPublicWebUrl(url)) return false;
  try {
    const addresses = await resolveHost(new URL(url).hostname);
    return addresses.length > 0 && addresses.every((entry) => isPublicAddress(entry.address));
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

/** The readable page from a final, non-redirect reply, or `null` when it failed, isn't HTML or is too large. */
async function readPage(response: Response, url: string, options: FetchOptions): Promise<FetchedPage | null> {
  if (!response.ok) return null;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;
  const declared = Number(response.headers.get("content-length") ?? "0");
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (declared > maxBytes) return null;
  const html = await response.text();
  if (html.length > maxBytes) return null;
  const { title, text } = readableText(html);
  if (text === "") return null;
  return { url, title: title || new URL(url).hostname, text: text.slice(0, options.maxChars ?? DEFAULT_MAX_CHARS) };
}

/** Load `url` and return its readable text, or `null` when any hop is private, it fails, isn't HTML or is too large. */
export async function fetchPage(url: string, options: FetchOptions = {}): Promise<FetchedPage | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const signal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      // fetch resolves the name again, so a DNS rebinding race between the two lookups remains; no custom agent pins the address.
      if (!(await isSafeToRequest(current, resolveHost))) return null;
      const response = await fetchImpl(current, {
        redirect: "manual",
        signal,
        headers: { accept: "text/html", "user-agent": "AnchoredDiscovery/1.0 (tool catalog review)" },
      });
      if (!REDIRECT_STATUSES.has(response.status)) return await readPage(response, current, options);
      const location = response.headers.get("location");
      response.body?.cancel().catch(() => undefined);
      if (location === null) return null;
      current = new URL(location, current).toString();
    }
    return null;
  } catch {
    // Timeouts, refused connections and bad TLS all mean the same thing here: no page to read.
    return null;
  }
}
