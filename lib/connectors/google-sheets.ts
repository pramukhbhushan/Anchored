import "server-only";
import { createSign } from "node:crypto";
import { z } from "zod";
import { ConnectorError, type FetchLike } from "./errors";

// =============================================================================
// Module Overview
// =============================================================================
// Reads an owner's Google Sheet as Anchored's service account, a Google robot
// account the owner shares the sheet with as a Viewer. `serviceAccountFrom`
// reads the account's key from `GOOGLE_SERVICE_ACCOUNT_JSON`; `readSheetValues`
// signs in with a read-only Sheets token and returns the first tab's cells as
// text. Nothing here writes to a sheet. A sheet the robot can't open raises a
// `ConnectorError` that tells the owner how to share it.

/** Anchored's Google robot account: the email owners share sheets with, and its private key. */
export interface ServiceAccount {
  readonly clientEmail: string;
  readonly privateKey: string;
}

const keyFile = z.object({ client_email: z.string().email(), private_key: z.string().startsWith("-----BEGIN PRIVATE KEY-----") });

/** Read the service account from `GOOGLE_SERVICE_ACCOUNT_JSON`, or `null` when it is unset or not a service account key. */
export function serviceAccountFrom(env: Readonly<Record<string, string | undefined>>): ServiceAccount | null {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = keyFile.safeParse(JSON.parse(raw));
    return parsed.success ? { clientEmail: parsed.data.client_email, privateKey: parsed.data.private_key } : null;
  } catch {
    return null;
  }
}

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// One token serves every read for an hour, so it is kept until a minute before it expires.
let cached: { readonly email: string; readonly token: string; readonly until: number } | null = null;

/** A read-only Sheets access token for `account`, reused until shortly before it expires. */
export async function sheetsToken(account: ServiceAccount, fetchImpl: FetchLike = fetch, nowMs = Date.now()): Promise<string> {
  if (cached && cached.email === account.clientEmail && cached.until > nowMs) return cached.token;
  const now = Math.floor(nowMs / 1000);
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.privateKey, "base64url");
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }).toString(),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!response.ok || typeof body.access_token !== "string") {
    throw new ConnectorError("Anchored couldn't sign in to Google Sheets. The server's Google key may be wrong or deleted.", false);
  }
  cached = { email: account.clientEmail, token: body.access_token, until: nowMs + ((body.expires_in ?? 3600) - 60) * 1000 };
  return body.access_token;
}

/** Forget the cached token. Tests call it so each starts signed out. */
export function clearSheetsToken(): void {
  cached = null;
}

const valuesReply = z.object({ values: z.array(z.array(z.unknown())).optional() });
const errorReply = z.object({ error: z.object({ status: z.string().optional(), message: z.string().optional() }).optional() });

/** Read up to 1,000 rows and 26 columns of the sheet's first tab, every cell as the text it shows. */
export async function readSheetValues(account: ServiceAccount, sheetId: string, fetchImpl: FetchLike = fetch): Promise<string[][]> {
  const token = await sheetsToken(account, fetchImpl);
  // A range without a tab name reads the first tab, whatever the owner named it.
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/A1:Z1000?valueRenderOption=FORMATTED_VALUE`;
  const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw sheetError(response.status, errorReply.safeParse(body).data?.error, account.clientEmail);
  const values = valuesReply.safeParse(body).data?.values ?? [];
  return values.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
}

/** The owner-facing reason Google refused a read. */
function sheetError(status: number, error: { status?: string; message?: string } | undefined, robot: string): ConnectorError {
  const message = error?.message ?? "";
  if (status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(`${message} ${error?.status ?? ""}`)) {
    return new ConnectorError("The Google Sheets API is turned off for Anchored's Google project. Turn it on in Google Cloud, then try again.", false);
  }
  if (status === 403) return new ConnectorError(`I can't open that sheet yet. In Google Sheets, click Share, add ${robot} as a Viewer, then send me the link again.`, false);
  if (status === 404) return new ConnectorError("I couldn't find that sheet. Check the link, or make sure it wasn't deleted.", false);
  if (status === 429 || status >= 500) return new ConnectorError("Google Sheets is busy right now. Try again in a minute.", true);
  return new ConnectorError("Google Sheets refused the read. Check the link and the sharing, then try again.", false);
}
