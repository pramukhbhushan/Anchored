import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { ConnectorError } from "./errors";
import { clearSheetsToken, readSheetValues, serviceAccountFrom, type ServiceAccount } from "./google-sheets";

// =============================================================================
// Module Overview
// =============================================================================
// Reading a Google Sheet as Anchored's service account, against a fake
// `fetch`: the key read from the environment, a signed read-only token reused
// until it expires, the first tab's cells as text, and an owner-facing message
// for a sheet that isn't shared, is missing, or sits in a project with the API off.

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const ACCOUNT: ServiceAccount = { clientEmail: "anchored-reader@test-project.iam.gserviceaccount.com", privateKey };

/** A fake `fetch` that answers the token URL, then each Sheets call with the next reply, and records the calls. */
function fakeGoogle(...sheets: { status: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "token-1", expires_in: 3600 });
    const next = sheets.shift() ?? { status: 500, body: {} };
    return Response.json(next.body, { status: next.status });
  };
  return { calls, fetchImpl };
}

beforeEach(() => clearSheetsToken());

describe("serviceAccountFrom", () => {
  it("reads the key from GOOGLE_SERVICE_ACCOUNT_JSON", () => {
    const json = JSON.stringify({ type: "service_account", client_email: ACCOUNT.clientEmail, private_key: privateKey });
    expect(serviceAccountFrom({ GOOGLE_SERVICE_ACCOUNT_JSON: json })).toEqual(ACCOUNT);
  });

  it("returns null when it's unset or not a service account key", () => {
    expect(serviceAccountFrom({})).toBeNull();
    expect(serviceAccountFrom({ GOOGLE_SERVICE_ACCOUNT_JSON: "not json" })).toBeNull();
    expect(serviceAccountFrom({ GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "x@y.com" }) })).toBeNull();
  });
});

describe("readSheetValues", () => {
  it("signs in read-only and returns the first tab's cells as text", async () => {
    const google = fakeGoogle({ status: 200, body: { values: [["Invoice #", "Amount"], [1042, 450], ["1043"]] } });

    expect(await readSheetValues(ACCOUNT, "sheet-123", google.fetchImpl)).toEqual([["Invoice #", "Amount"], ["1042", "450"], ["1043"]]);

    const [token, read] = google.calls;
    const assertion = new URLSearchParams(String(token?.init?.body)).get("assertion") ?? "";
    const claims = JSON.parse(Buffer.from(assertion.split(".")[1] ?? "", "base64url").toString()) as { iss: string; scope: string };
    expect(claims).toMatchObject({ iss: ACCOUNT.clientEmail, scope: "https://www.googleapis.com/auth/spreadsheets.readonly" });
    // No tab name in the range, so the first tab is read whatever it's called.
    expect(read?.url).toBe("https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/A1:Z1000?valueRenderOption=FORMATTED_VALUE");
    expect(new Headers(read?.init?.headers).get("authorization")).toBe("Bearer token-1");
  });

  it("reuses the token for the next read", async () => {
    const google = fakeGoogle({ status: 200, body: { values: [] } }, { status: 200, body: {} });
    await readSheetValues(ACCOUNT, "a", google.fetchImpl);
    expect(await readSheetValues(ACCOUNT, "b", google.fetchImpl)).toEqual([]);
    expect(google.calls.filter((call) => call.url.includes("oauth2"))).toHaveLength(1);
  });

  it("tells the owner how to share a sheet the robot can't open", async () => {
    const google = fakeGoogle({ status: 403, body: { error: { status: "PERMISSION_DENIED", message: "The caller does not have permission" } } });
    const read = readSheetValues(ACCOUNT, "a", google.fetchImpl);
    await expect(read).rejects.toBeInstanceOf(ConnectorError);
    await expect(read).rejects.toThrow(`click Share, add ${ACCOUNT.clientEmail} as a Viewer`);
  });

  it("says when the Sheets API is off, the sheet is missing, or Google is busy", async () => {
    const off = fakeGoogle({ status: 403, body: { error: { status: "PERMISSION_DENIED", message: "Google Sheets API has not been used in project 1 before or it is disabled." } } });
    await expect(readSheetValues(ACCOUNT, "a", off.fetchImpl)).rejects.toThrow("Google Sheets API is turned off");
    const missing = fakeGoogle({ status: 404, body: { error: { status: "NOT_FOUND" } } });
    await expect(readSheetValues(ACCOUNT, "a", missing.fetchImpl)).rejects.toThrow("couldn't find that sheet");
    const busy = fakeGoogle({ status: 503, body: {} });
    await expect(readSheetValues(ACCOUNT, "a", busy.fetchImpl)).rejects.toMatchObject({ retryable: true });
  });

  it("says when Google refuses the sign-in", async () => {
    const fetchImpl = async () => Response.json({ error: "invalid_grant" }, { status: 400 });
    await expect(readSheetValues(ACCOUNT, "a", fetchImpl)).rejects.toThrow("couldn't sign in to Google Sheets");
  });
});
