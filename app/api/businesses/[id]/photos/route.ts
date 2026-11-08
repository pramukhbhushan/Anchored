import type { PhotoUploadResponse } from "@/lib/api/contract";
import { MAX_PHOTO_BYTES, checkPhoto, sniffPhotoType } from "@/lib/domain/photos";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBytesCapped } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/businesses/[id]/photos stores one photo for a post. The body is the
// photo's bytes with its image type as `Content-Type`; that type is never one a
// plain cross-site form can send, so the browser asks first and the middleware's
// origin check refuses other sites. The bytes must really be a JPEG, PNG or WebP.

type Context = { params: Promise<{ id: string }> };

/** Store one photo the owner picked for a post, and return its id and address. */
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("image/")) {
      return fail(415, "Send the photo itself, with its image type as `Content-Type`.");
    }
    const business = await findBusiness(id);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    if (business.kind === "case") return fail(403, `${business.name} is an example, so it can't hold your photos. Set up your business to try this.`);
    const bytes = await readBytesCapped(request, MAX_PHOTO_BYTES);
    if (bytes === null) return fail(413, `That photo is over ${MAX_PHOTO_BYTES / 1024 / 1024} MB. Try a smaller one.`);
    const problem = checkPhoto(bytes);
    const type = sniffPhotoType(bytes);
    if (problem !== null || type === null) return fail(400, problem ?? "That file isn't a photo.");
    const photo = await getStore().savePhoto(await getSessionId(), business.id, bytes, type);
    return json<PhotoUploadResponse>({ photo: { id: photo.id, url: `/api/businesses/${business.id}/photos/${photo.id}` } }, 201);
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/photos");
  }
}
