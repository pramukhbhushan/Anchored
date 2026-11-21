import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { ApiError } from "@/lib/api/contract";
import { authConfig, type AuthConfig } from "@/lib/auth/config";
import { loginHref, needsSignIn } from "@/lib/auth/paths";
import { isSessionId } from "@/lib/auth/session-id";
import { isAllowedOrigin } from "@/lib/server/origin";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-cookie";

// =============================================================================
// Module Overview
// =============================================================================
// Refuses cross-site and oversized API mutations, ties every visitor to a
// session, then rate-limits API mutations per session and per IP. The IP comes
// from proxy headers only on Vercel or with `TRUST_PROXY_HEADERS=1`; elsewhere a
// request with a session counts under it alone. With accounts
// on, the session is the Supabase user and signed-out visitors bound for `/app`
// go to `/login`; with accounts off, it is an anonymous `anchored_session` cookie.

// =============================================================================
// API mutation guards
// =============================================================================

/** A route's rate limits per window: one per visitor session, and a looser one per IP. */
export interface ApiLimit {
  readonly bucket: string;
  readonly windowMs: number;
  readonly perSession: number;
  readonly perIp: number;
}

const WINDOW_MS = 10 * 60 * 1000;

// Routes that call a paid model get the tightest limits. Per-IP limits are five to six
// times looser, since everyone on one office or event Wi-Fi shares a single address.
const LIMITS = {
  createBusiness: { bucket: "create-business", windowMs: WINDOW_MS, perSession: 10, perIp: 60 },
  rewrite: { bucket: "rewrite", windowMs: WINDOW_MS, perSession: 20, perIp: 120 },
  // One onboarding runs 11 to 14 turns and an owner may map several businesses, so 90 fits three
  // onboardings plus chat. The daily model budget in `lib/server/ai-budget.ts` caps the spend.
  chat: { bucket: "chat", windowMs: WINDOW_MS, perSession: 90, perIp: 450 },
  newEvent: { bucket: "new-event", windowMs: WINDOW_MS, perSession: 60, perIp: 300 },
  // Connecting a service and adding a contact create rows, so they get their own bucket.
  connect: { bucket: "connect", windowMs: WINDOW_MS, perSession: 60, perIp: 300 },
  // Each photo is its own request, and a post holds up to 10.
  photo: { bucket: "photo", windowMs: WINDOW_MS, perSession: 100, perIp: 500 },
  // Turning a job on can add a question to the chat, so the switch gets its own bucket.
  automation: { bucket: "automation", windowMs: WINDOW_MS, perSession: 60, perIp: 300 },
  // Twilio, Stripe and Postmark post from shared addresses with no session, so only the per-IP limit holds them.
  hook: { bucket: "hook", windowMs: WINDOW_MS, perSession: 600, perIp: 3000 },
  // Recorded follow-ups and license dates create rows and can draft a card.
  agentWork: { bucket: "agent-work", windowMs: WINDOW_MS, perSession: 30, perIp: 150 },
  telegramDelete: { bucket: "telegram-delete", windowMs: WINDOW_MS, perSession: 20, perIp: 100 },
  // Run now writes a brief card; a few a minute is plenty for an owner checking it.
  brief: { bucket: "brief", windowMs: WINDOW_MS, perSession: 30, perIp: 150 },
  // Approving the plan and adding a job each save a new profile version, a full snapshot row.
  profile: { bucket: "profile", windowMs: WINDOW_MS, perSession: 30, perIp: 150 },
  mutation: { bucket: "mutation", windowMs: WINDOW_MS, perSession: 120, perIp: 600 },
} as const satisfies Record<string, ApiLimit>;

/** Largest request body accepted, by its declared `content-length`. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Largest photo upload accepted. Matches `MAX_PHOTO_BYTES` in `lib/domain/photos.ts`, which the edge can't import. */
export const MAX_PHOTO_BODY_BYTES = 5 * 1024 * 1024;

/** Report whether `pathname` is the photo upload route. */
function isPhotoUpload(pathname: string): boolean {
  return /^\/api\/businesses\/[^/]+\/photos\/?$/.test(pathname);
}

/** Largest webhook body accepted. A forwarded email arrives with its attachments, which Anchored ignores. */
export const MAX_HOOK_BODY_BYTES = 4 * 1024 * 1024;

// Module scope lives as long as the server instance, so counts carry across requests.
const limiter = createRateLimiter();

/** Report whether a proxy in front of this server sets the client IP headers: on Vercel, or with `TRUST_PROXY_HEADERS=1`. */
export function trustsProxyHeaders(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.VERCEL === "1" || env.TRUST_PROXY_HEADERS === "1";
}

/** Return the caller's IP from `x-real-ip`, then the first `x-forwarded-for` entry, or `null` when neither is set or trusted. */
export function clientIp(headers: Headers, env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  // With no proxy to set them, a client writes these headers itself and could pick a fresh bucket per request.
  if (!trustsProxyHeaders(env)) return null;
  // Vercel sets `x-real-ip` to the address that connected, so a client can't choose its bucket there.
  // A client can prepend its own entries to `x-forwarded-for`, so that header is only the fallback.
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

const HEXTET = /^[0-9a-f]{1,4}$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;

/** Return the first four hextets of an IPv6 address as `a:b:c:d::/64`, or `null` when it doesn't parse. */
function ipv6Prefix(address: string): string | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const groupsOf = (part: string | undefined): string[] => (part ? part.split(":") : []);
  const head = groupsOf(halves[0]);
  const tail = groupsOf(halves[1]);
  // A dotted IPv4 tail, as in `64:ff9b::192.0.2.1`, fills the last two hextets.
  const width = (groups: readonly string[]): number => groups.reduce((sum, group) => sum + (IPV4.test(group) ? 2 : 1), 0);
  const elided = 8 - width(head) - width(tail);
  const compressed = halves.length === 2;
  if (compressed ? elided < 1 : elided !== 0) return null;
  const groups = [...head, ...Array<string>(elided).fill("0"), ...tail];
  const last = groups.length - 1;
  if (!groups.every((group, i) => HEXTET.test(group) || (i === last && IPV4.test(group)))) return null;
  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(":")}::/64`;
}

/** Return the key one client's requests count under: an IPv4 address whole, an IPv6 address by its /64 prefix. */
export function clientKey(ip: string): string {
  const address = ip.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1").split("%")[0] ?? "";
  const mapped = IPV4_MAPPED.exec(address)?.[1];
  if (mapped) return mapped;
  if (!address.includes(":")) return address;
  // One subscriber usually holds a whole /64, so keying by full address would let them rotate through it.
  return ipv6Prefix(address) ?? address;
}

/** Return the rate limits for a `method` request to `pathname`, an API mutation. */
export function limitFor(method: string, pathname: string): ApiLimit {
  if (pathname.startsWith("/api/hooks/")) return LIMITS.hook;
  if (/^\/api\/businesses\/[^/]+\/(?:connections|contacts)(?:\/[^/]+)?\/?$/.test(pathname)) return LIMITS.connect;
  if (/^\/api\/businesses\/[^/]+\/automations\/?$/.test(pathname)) return LIMITS.automation;
  if (method === "POST" && /^\/api\/businesses\/[^/]+\/outbox\/[^/]+\/delete\/?$/.test(pathname)) return LIMITS.telegramDelete;
  if (/^\/api\/businesses\/[^/]+\/(?:followups|licenses)\/?$/.test(pathname)) return LIMITS.agentWork;
  if (method === "PUT" && /^\/api\/businesses\/[^/]+\/plan\/?$/.test(pathname)) return LIMITS.profile;
  if (method !== "POST") return LIMITS.mutation;
  if (isPhotoUpload(pathname)) return LIMITS.photo;
  if (/^\/api\/businesses\/?$/.test(pathname)) return LIMITS.createBusiness;
  if (/^\/api\/cards\/[^/]+\/rewrite\/?$/.test(pathname)) return LIMITS.rewrite;
  if (/^\/api\/intake(\/[^/]+)?\/?$/.test(pathname) || /^\/api\/businesses\/[^/]+\/chat\/?$/.test(pathname)) return LIMITS.chat;
  // Reading the invoice sheet drafts cards the way an arriving event does, so it shares their bucket.
  if (/^\/api\/businesses\/[^/]+\/(?:cards|invoice-sheet)\/?$/.test(pathname) || /^\/api\/ingest\/[^/]+\/?$/.test(pathname)) return LIMITS.newEvent;
  if (/^\/api\/businesses\/[^/]+\/brief\/?$/.test(pathname)) return LIMITS.brief;
  if (/^\/api\/businesses\/[^/]+\/workflows\/?$/.test(pathname)) return LIMITS.profile;
  return LIMITS.mutation;
}

/** Report whether a declared `content-length` is over `max`, `MAX_BODY_BYTES` unless a route allows more. */
export function isBodyTooLarge(contentLength: string | null, max: number = MAX_BODY_BYTES): boolean {
  // Checks the declared length only. A chunked body without one reaches the
  // route, where Vercel's own body limit and the Zod length caps still apply.
  return contentLength !== null && Number(contentLength) > max;
}

/** Return an `ApiError` JSON response. */
function refuse(status: number, error: string, headers?: HeadersInit): NextResponse<ApiError> {
  return NextResponse.json({ error }, { status, headers });
}

/** Return "1 minute" or "N minutes", rounding `seconds` up. */
function minutesText(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/** Report whether the request is an API call that can change data. */
function isApiMutation(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/api/") && request.method !== "GET" && request.method !== "HEAD";
}

/** Return the refusal for a cross-site or oversized API mutation, or `null` to let it through. */
function refuseUnsafeMutation(request: NextRequest): NextResponse<ApiError> | null {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (!isAllowedOrigin(request.headers.get("origin"), host)) {
    return refuse(403, "This request came from another site. Open Anchored itself and try again.");
  }
  const path = request.nextUrl.pathname;
  const max = path.startsWith("/api/hooks/") ? MAX_HOOK_BODY_BYTES : isPhotoUpload(path) ? MAX_PHOTO_BODY_BYTES : MAX_BODY_BYTES;
  if (isBodyTooLarge(request.headers.get("content-length"), max)) {
    return refuse(413, `This request is too large. Keep it under ${max / 1024} KB.`);
  }
  return null;
}

/**
 * Return the rate-limit counters one API mutation counts against, in order: its session, then its IP. `carried` says
 * the request arrived with `sessionKey` rather than having one minted for it, and `ip` is `null` when it isn't trusted.
 */
export function limitChecks(rule: ApiLimit, sessionKey: string | null, carried: boolean, ip: string | null): [key: string, limit: number][] {
  // Session first: a refused check counts nothing, so one busy session can't spend the budget its whole room shares.
  // A client that drops its cookie gets a new session each time, which leaves only the per-IP limit to hold it.
  const checks: [key: string, limit: number][] = [];
  if (sessionKey !== null) checks.push([`session:${rule.bucket}:${sessionKey}`, rule.perSession]);
  if (ip !== null) {
    checks.push([`ip:${rule.bucket}:${clientKey(ip)}`, rule.perIp]);
  } else if (!carried) {
    // With no trusted IP, a request that brought its session is held by the session limit alone. One that brought
    // none, such as a dropped cookie, a signed-out visitor or a webhook, could mint a new session every time, so
    // all of those share one bucket at the per-IP limit.
    checks.push([`ip:${rule.bucket}:no-session`, rule.perIp]);
  }
  return checks;
}

/** Count an API mutation against its session and its IP, and return the refusal when either is over its limit. */
function refuseOverLimit(request: NextRequest, visit: Visit): NextResponse<ApiError> | null {
  const rule = limitFor(request.method, request.nextUrl.pathname);
  for (const [key, limit] of limitChecks(rule, visit.sessionKey, visit.carried, clientIp(request.headers))) {
    const decision = limiter.check(key, { limit, windowMs: rule.windowMs });
    if (!decision.allowed) {
      return refuse(429, `Too many requests. Wait ${minutesText(decision.retryAfterSeconds)} and try again.`, {
        "Retry-After": String(decision.retryAfterSeconds),
      });
    }
  }
  return null;
}

// =============================================================================
// Sessions
// =============================================================================

/** The response that lets a request through, and who it counts against for per-session limits. */
interface Visit {
  readonly response: NextResponse;
  /** The anonymous session id or the Supabase user id, or `null` when nobody is signed in. */
  readonly sessionKey: string | null;
  /** Whether the request arrived with that session, rather than having it minted on this request. */
  readonly carried: boolean;
}

/** Copy the cookies `from` sets onto `to`, so a session change survives a redirect or a refusal. */
function carryCookies<T extends NextResponse>(from: NextResponse, to: T): T {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  return to;
}

/** Accounts off: keep the visitor's anonymous session, minting a fresh one when the cookie is missing or malformed. */
function withSession(request: NextRequest): Visit {
  const current = request.cookies.get(SESSION_COOKIE)?.value;
  // A missing, empty, oversized or hand-edited value gets replaced, so the server only ever reads a UUID.
  if (isSessionId(current)) return { response: NextResponse.next(), sessionKey: current, carried: true };
  const sessionId = crypto.randomUUID();
  // Setting it on the request lets server components in this same request read it.
  request.cookies.set(SESSION_COOKIE, sessionId);
  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return { response, sessionKey: sessionId, carried: false };
}

/** Refresh the visitor's Supabase session, and return the id of the verified user who holds it. */
async function refreshAccount(request: NextRequest, config: AuthConfig): Promise<{ response: NextResponse; userId: string | null }> {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // New tokens go on the request so this render sees them, then on a rebuilt response so the browser keeps them.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // `@supabase/ssr` sends no-store headers with new tokens, so no cache hands one visitor's session to another.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  // Nothing may run between creating the client and this call: it refreshes an expired token,
  // then verifies the signature, asking Supabase Auth when the project signs with a shared secret.
  const { data } = await supabase.auth.getClaims();
  return { response, userId: data?.claims.sub || null };
}

/** Accounts on: refresh the session, and send a signed-out visitor bound for the app to the sign-in page. */
async function withAccount(request: NextRequest, config: AuthConfig): Promise<Visit> {
  const { response, userId } = await refreshAccount(request, config);
  const { pathname, search } = request.nextUrl;
  if (userId !== null || !needsSignIn(pathname)) return { response, sessionKey: userId, carried: userId !== null };
  const redirect = NextResponse.redirect(new URL(loginHref(`${pathname}${search}`), request.url));
  // A refresh that failed clears the dead session cookies; the redirect must carry that too.
  return { response: carryCookies(response, redirect), sessionKey: null, carried: false };
}

// =============================================================================
// Entry point
// =============================================================================

/** Refuse an unsafe or over-limit API mutation; otherwise let the request through tied to a session. */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const mutation = isApiMutation(request);
  // Cheap refusals run before any session work, so a refused call costs no Supabase round trip or rate limit.
  const unsafe = mutation ? refuseUnsafeMutation(request) : null;
  if (unsafe) return unsafe;

  const config = authConfig();
  const visit = config === null ? withSession(request) : await withAccount(request, config);
  const overLimit = mutation ? refuseOverLimit(request, visit) : null;
  // A refreshed Supabase token must still reach the browser, or its next request replays a spent refresh token.
  return overLimit ? carryCookies(visit.response, overLimit) : visit.response;
}

export const config = {
  // Skip static assets; every page and API route needs the session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
