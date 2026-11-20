// =============================================================================
// Module Overview
// =============================================================================
// The rules for photos an owner uploads for a post. The browser shrinks each
// photo before it uploads, so the server only accepts JPEG, PNG or WebP under
// `MAX_PHOTO_BYTES`. `sniffPhotoType` reads the file's first bytes rather than
// trusting the type the browser declared, so a renamed file can't get through.

/** The image types a post photo may be. */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** One accepted image type. */
export type PhotoType = (typeof PHOTO_TYPES)[number];

/** Largest photo accepted after the browser shrinks it. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Most photos one post holds, the carousel limit we design for. */
export const MAX_PHOTOS_PER_POST = 10;

/** Longest side, in pixels, the browser shrinks a photo to before upload. */
export const PHOTO_MAX_SIDE = 2048;

/** A photo id is a UUID, which keeps it safe to use in a storage path. */
export const PHOTO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Return the image type `bytes` start with, or `null` when they aren't a JPEG, PNG or WebP. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  const starts = (sig: readonly number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" then four size bytes then "WEBP".
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Why `bytes` can't be a post photo, in words an owner can act on, or `null` when it can. */
export function checkPhoto(bytes: Uint8Array): string | null {
  if (bytes.byteLength === 0) return "That photo came through empty. Try adding it again.";
  if (bytes.byteLength > MAX_PHOTO_BYTES) return `That photo is over ${MAX_PHOTO_BYTES / 1024 / 1024} MB. Try a smaller one.`;
  if (sniffPhotoType(bytes) === null) return "That file isn't a JPEG, PNG or WebP photo. Try another photo.";
  return null;
}
