import { NextResponse, type NextRequest } from "next/server";
import type { ApiError } from "@/lib/api/contract";
import { createRateLimiter, type RateLimitRule } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-cookie";

// =============================================================================
// Module Overview
// =============================================================================
// Gives every visitor an anonymous demo session, so judges can test without
// logging in and still see only their own businesses, choices and cards.
// Before an API mutation reaches its route, it refuses cross-site calls,
// oversized bodies and clients over their `limitFor` rate limit.

// =============================================================================
// API mutation guards
// =============================================================================

/** A rate limit plus the bucket its requests count against. */
export interface ApiLimit extends RateLimitRule {
  readonly bucket: string;
}

const WINDOW_MS = 10 * 60 * 1000;

// Routes that call a paid model get the tightest limits.
const LIMITS = {
  createBusiness: { bucket: "create-business", limit: 10, windowMs: WINDOW_MS },
  rewrite: { bucket: "rewrite", limit: 20, windowMs: WINDOW_MS },
  newEvent: { bucket: "new-event", limit: 60, windowMs: WINDOW_MS },
  mutation: { bucket: "mutation", limit: 120, windowMs: WINDOW_MS },
} as const satisfies Record<string, ApiLimit>;

/** Largest request body accepted, by its declared `content-length`. */
export const MAX_BODY_BYTES = 64 * 1024;

// Module scope lives as long as the server instance, so counts carry across requests.
const limiter = createRateLimiter();

/** Report whether a mutation's `Origin` header allows it: absent, or naming `host`. */
export function isAllowedOrigin(origin: string | null, host: string): boolean {
  // Only browsers send `Origin`, and only a browser carries a visitor's cookie for them.
  if (origin === null) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    // The literal "null" that sandboxed frames and file pages send lands here too.
    return false;
  }
  return originHost.toLowerCase() === host.toLowerCase();
}

/** Return the caller's IP: the first `x-forwarded-for` entry, then `x-real-ip`, then "unknown". */
export function clientIp(headers: Headers): string {
  // Vercel overwrites `x-forwarded-for` with the real client address, so a client can't choose its bucket there.
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Return the rate limit for a `method` request to `pathname`, an API mutation. */
export function limitFor(method: string, pathname: string): ApiLimit {
  if (method !== "POST") return LIMITS.mutation;
  if (/^\/api\/businesses\/?$/.test(pathname)) return LIMITS.createBusiness;
  if (/^\/api\/cards\/[^/]+\/rewrite\/?$/.test(pathname)) return LIMITS.rewrite;
  if (/^\/api\/businesses\/[^/]+\/cards\/?$/.test(pathname) || /^\/api\/ingest\/[^/]+\/?$/.test(pathname)) return LIMITS.newEvent;
  return LIMITS.mutation;
}

/** Report whether a declared `content-length` is over `MAX_BODY_BYTES`. */
export function isBodyTooLarge(contentLength: string | null): boolean {
  // Checks the declared length only. A chunked body without one reaches the
  // route, where Vercel's own body limit and the Zod length caps still apply.
  return contentLength !== null && Number(contentLength) > MAX_BODY_BYTES;
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

/** Return the refusal for an API mutation that breaks a guard, or `null` to let it through. */
function guardApiMutation(request: NextRequest): NextResponse<ApiError> | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/") || request.method === "GET" || request.method === "HEAD") return null;

  // Cheap refusals run first, so a refused call never spends the visitor's rate limit.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (!isAllowedOrigin(request.headers.get("origin"), host)) {
    return refuse(403, "This request came from another site. Open Anchored itself and try again.");
  }
  if (isBodyTooLarge(request.headers.get("content-length"))) {
    return refuse(413, `This request is too large. Keep it under ${MAX_BODY_BYTES / 1024} KB.`);
  }

  const rule = limitFor(request.method, pathname);
  const decision = limiter.check(`${rule.bucket}:${clientIp(request.headers)}`, rule);
  if (!decision.allowed) {
    return refuse(429, `Too many requests. Wait ${minutesText(decision.retryAfterSeconds)} and try again.`, {
      "Retry-After": String(decision.retryAfterSeconds),
    });
  }
  return null;
}

// =============================================================================
// Session cookie
// =============================================================================

/** Set the session cookie on first visit, visible to this request and later ones. */
function withSession(request: NextRequest): NextResponse {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
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
  return response;
}

/** Refuse an API mutation that breaks a guard; otherwise make sure the visitor has a session. */
export function middleware(request: NextRequest): NextResponse {
  return guardApiMutation(request) ?? withSession(request);
}

export const config = {
  // Skip static assets; every page and API route needs the session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
