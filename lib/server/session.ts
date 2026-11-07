import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// =============================================================================
// Module Overview
// =============================================================================
// Reads the anonymous demo session id that `middleware.ts` assigns.

/** Return this visitor's session id. */
export async function getSessionId(): Promise<string> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) {
    throw new Error(`Session cookie \`${SESSION_COOKIE}\` is missing. Check that \`middleware.ts\` runs for this route.`);
  }
  return value;
}
