"use client";

import { useEffect, useRef, useState } from "react";
import { ApiCallError, errorText } from "@/components/api";
import type { PhotoUploadResponse } from "@/lib/api/contract";
import { MAX_PHOTOS_PER_POST, PHOTO_MAX_SIDE } from "@/lib/domain/photos";

// =============================================================================
// Module Overview
// =============================================================================
// Photos the owner adds to a chat message for a post. Each photo is redrawn on a
// canvas at no more than `PHOTO_MAX_SIDE` pixels and saved as a JPEG, which keeps
// uploads small and drops the location and camera data phones hide in photos.
// `usePhotoPicker` uploads each photo as soon as it's added, so the post is ready
// to send by the time the owner has typed what the photos show.

/** One photo in the tray: uploading, ready with its server id, or failed with a reason. */
export interface PickedPhoto {
  readonly key: string;
  readonly name: string;
  /** A local preview address, released when the photo leaves the tray. */
  readonly preview: string;
  readonly status: "uploading" | "ready" | "failed";
  readonly id?: string;
  readonly error?: string;
}

const UNREADABLE = "This photo couldn't be opened here. Try a JPEG or PNG, or take a screenshot of it.";
const OFFLINE = "Couldn't reach Anchored. Check your connection and try again.";

/** Redraw `file` as a JPEG no larger than `PHOTO_MAX_SIDE` on its longest side, without its hidden metadata. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  // A browser without image decoding sends the original; the server still checks it's a real photo under the limit.
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(UNREADABLE);
  }
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error(UNREADABLE);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error(UNREADABLE);
  return blob;
}

/** Upload one shrunk photo for `businessId` and return its id, or throw an error safe to show the owner. */
export async function uploadPhoto(businessId: string, photo: Blob): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/photos`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: photo });
  } catch (cause) {
    throw new ApiCallError(OFFLINE, 0, { cause });
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "That photo didn't upload. Try again.";
    throw new ApiCallError(reason, response.status);
  }
  return (data as PhotoUploadResponse).photo.id;
}

/** What the tray needs from the picker. */
export interface PhotoPicker {
  readonly photos: readonly PickedPhoto[];
  /** Ids of uploaded photos, in tray order. */
  readonly readyIds: readonly string[];
  readonly uploading: boolean;
  readonly full: boolean;
  /** Why some picked files weren't added, such as going past the limit, or `null`. */
  readonly notice: string | null;
  add(files: readonly File[]): void;
  remove(key: string): void;
  /** Take out the photos with these server ids, once the message they went with is sent. */
  release(ids: readonly string[]): void;
}

/** Hold the photos picked for one post in `businessId`'s chat, shrinking and uploading each as it's added. */
export function usePhotoPicker(businessId: string, shrink = shrinkPhoto, upload = uploadPhoto): PhotoPicker {
  const [photos, setPhotos] = useState<readonly PickedPhoto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const counter = useRef(0);
  const live = useRef(photos);
  live.current = photos;

  // Release every preview when the chat goes away.
  useEffect(() => () => live.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  function update(key: string, patch: Partial<PickedPhoto>): void {
    setPhotos((all) => all.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function add(files: readonly File[]): void {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_PHOTOS_PER_POST - live.current.length;
    const taken = images.slice(0, Math.max(0, room));
    const skipped = files.length - taken.length;
    setNotice(
      skipped === 0
        ? null
        : images.length > taken.length
          ? `A post holds up to ${MAX_PHOTOS_PER_POST} photos, so ${images.length - taken.length} ${images.length - taken.length === 1 ? "wasn't" : "weren't"} added.`
          : "Only photos can be added to a post.",
    );
    const fresh = taken.map((file) => ({ file, photo: { key: `photo-${counter.current++}`, name: file.name, preview: URL.createObjectURL(file), status: "uploading" as const } }));
    setPhotos((all) => [...all, ...fresh.map((f) => f.photo)]);
    for (const { file, photo } of fresh) {
      void shrink(file)
        .then((small) => upload(businessId, small))
        .then((id) => update(photo.key, { status: "ready", id }))
        .catch((error: unknown) => update(photo.key, { status: "failed", error: errorText(error) }));
    }
  }

  /** Take every photo `match` picks out of the tray and release its preview. */
  function drop(match: (photo: PickedPhoto) => boolean): void {
    live.current.filter(match).forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos((all) => all.filter((p) => !match(p)));
    setNotice(null);
  }

  function remove(key: string): void {
    drop((p) => p.key === key);
  }

  function release(ids: readonly string[]): void {
    // Photos added while the message was sending weren't part of it, so they stay for the next one.
    drop((p) => p.id !== undefined && ids.includes(p.id));
  }

  return {
    photos,
    readyIds: photos.flatMap((p) => (p.status === "ready" && p.id ? [p.id] : [])),
    uploading: photos.some((p) => p.status === "uploading"),
    full: photos.length >= MAX_PHOTOS_PER_POST,
    notice,
    add,
    remove,
    release,
  };
}
