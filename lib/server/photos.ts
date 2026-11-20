import "server-only";
import type { PhotoFile, StoredPhoto } from "@/lib/store/types";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Stores and reads the photos an owner picks for a post, for the routes under
// `/api/businesses/[id]/photos`. The routes check the bytes and the business
// first; each read is scoped to the session that uploaded the photo.

/** Store one checked photo for one of the session's businesses. */
export async function savePhoto(session: string, businessId: string, data: Uint8Array, contentType: string): Promise<StoredPhoto> {
  return getStore().savePhoto(session, businessId, data, contentType);
}

/** Return a photo's bytes and type, or `null` when this session's business has no photo with that id. */
export async function readPhoto(session: string, businessId: string, photoId: string): Promise<PhotoFile | null> {
  return getStore().getPhoto(session, businessId, photoId);
}
