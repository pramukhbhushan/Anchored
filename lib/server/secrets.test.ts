import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canStoreSecrets, decryptSecret, encryptSecret, newHookId, sameSecret } from "./secrets";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of connected-credential encryption: a value comes back unchanged
// under the same key, a changed ciphertext fails to open, a server with no key
// can't store credentials, and hook ids are 24 lower-case letters and digits.

const ENV = { CONNECTOR_SECRET_KEY: randomBytes(32).toString("base64") };

describe("encryptSecret and decryptSecret", () => {
  it("round-trips a credential and stores only ciphertext", () => {
    const stored = encryptSecret("twilio-auth-token", ENV);
    expect(stored).not.toContain("twilio-auth-token");
    expect(decryptSecret(stored, ENV)).toBe("twilio-auth-token");
  });

  it("writes a different ciphertext each time", () => {
    expect(encryptSecret("same", ENV)).not.toBe(encryptSecret("same", ENV));
  });

  it("refuses a changed ciphertext", () => {
    const [version, iv, tag, sealed] = encryptSecret("twilio-auth-token", ENV).split(":");
    const bytes = Buffer.from(sealed ?? "", "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    expect(() => decryptSecret([version, iv, tag, bytes.toString("base64")].join(":"), ENV)).toThrow();
  });

  it("refuses a value sealed under another key", () => {
    const other = { CONNECTOR_SECRET_KEY: randomBytes(32).toString("base64") };
    expect(() => decryptSecret(encryptSecret("twilio-auth-token", other), ENV)).toThrow();
  });
});

describe("without a key", () => {
  it("can't store credentials", () => {
    expect(canStoreSecrets(ENV)).toBe(true);
    expect(canStoreSecrets({})).toBe(false);
    expect(canStoreSecrets({ CONNECTOR_SECRET_KEY: randomBytes(16).toString("base64") })).toBe(false);
    expect(() => encryptSecret("twilio-auth-token", {})).toThrow("CONNECTOR_SECRET_KEY");
  });
});

describe("sameSecret", () => {
  it("matches only an identical secret", () => {
    expect(sameSecret("inbound-secret", "inbound-secret")).toBe(true);
    expect(sameSecret("inbound-secret", "inbound-secreT")).toBe(false);
    expect(sameSecret("inbound-secret", "inbound")).toBe(false);
  });
});

describe("newHookId", () => {
  it("returns 24 lower-case letters and digits, different each time", () => {
    const ids = Array.from({ length: 20 }, () => newHookId());
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{24}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
