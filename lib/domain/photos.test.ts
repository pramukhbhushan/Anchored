import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, PHOTO_ID_PATTERN, checkPhoto, sniffPhotoType } from "./photos";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("sniffPhotoType", () => {
  it("reads JPEG, PNG and WebP from their first bytes", () => {
    expect(sniffPhotoType(JPEG)).toBe("image/jpeg");
    expect(sniffPhotoType(PNG)).toBe("image/png");
    expect(sniffPhotoType(WEBP)).toBe("image/webp");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(sniffPhotoType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffPhotoType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffPhotoType(new Uint8Array())).toBeNull();
  });
});

describe("checkPhoto", () => {
  it("passes a real photo", () => {
    expect(checkPhoto(JPEG)).toBeNull();
  });

  it("explains an empty, oversized or non-photo file in plain words", () => {
    expect(checkPhoto(new Uint8Array())).toMatch(/empty/);
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(JPEG);
    expect(checkPhoto(big)).toMatch(/over 5 MB/);
    expect(checkPhoto(new TextEncoder().encode("hello"))).toMatch(/isn't a JPEG, PNG or WebP/);
  });
});

describe("PHOTO_ID_PATTERN", () => {
  it("takes only a UUID, so an id can't climb out of its storage folder", () => {
    expect(PHOTO_ID_PATTERN.test("3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b")).toBe(true);
    expect(PHOTO_ID_PATTERN.test("../other-session/photo")).toBe(false);
  });
});
