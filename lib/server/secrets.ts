import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

// =============================================================================
// Module Overview
// =============================================================================
// Encrypts the credentials an owner connects, such as a Twilio auth token, so
// the database holds only ciphertext. AES-256-GCM under `CONNECTOR_SECRET_KEY`,
// 32 bytes in base64. With no key set, services that need a secret can't be
// connected. `sameSecret` compares two secrets in constant time.

const VERSION = "v1";

/** Return the 32-byte key from `CONNECTOR_SECRET_KEY`, or `null` when it is unset or the wrong length. */
function secretKey(env: Readonly<Record<string, string | undefined>> = process.env): Buffer | null {
  const raw = env.CONNECTOR_SECRET_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

/** Whether this server can store connected credentials. */
export function canStoreSecrets(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return secretKey(env) !== null;
}

/** Encrypt `plain` for the store. Throws when `CONNECTOR_SECRET_KEY` is missing. */
export function encryptSecret(plain: string, env: Readonly<Record<string, string | undefined>> = process.env): string {
  const key = secretKey(env);
  if (key === null) throw new Error("`CONNECTOR_SECRET_KEY` is not set to 32 bytes of base64, so connected credentials can't be stored.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const sealed = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), sealed.toString("base64")].join(":");
}

/** Decrypt a value `encryptSecret` wrote. Throws when the key is missing or the value was changed. */
export function decryptSecret(stored: string, env: Readonly<Record<string, string | undefined>> = process.env): string {
  const key = secretKey(env);
  if (key === null) throw new Error("`CONNECTOR_SECRET_KEY` is not set, so connected credentials can't be read.");
  const [version, iv, tag, sealed] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !sealed) throw new Error("A stored credential is not in a format this server reads.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed, "base64")), decipher.final()]).toString("utf8");
}

/** Compare two secrets without leaking, through timing, how much of them matched. */
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Return a random id for webhook URLs: 24 lower-case letters and digits. */
export function newHookId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(24), (byte) => alphabet[byte % alphabet.length]).join("");
}
