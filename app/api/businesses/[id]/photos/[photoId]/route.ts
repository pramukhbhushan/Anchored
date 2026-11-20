import { PHOTO_ID_PATTERN } from "@/lib/domain/photos";
import { fail, handleError } from "@/lib/server/http";
import { readPhoto } from "@/lib/server/photos";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// GET /api/businesses/[id]/photos/[photoId] returns one uploaded photo, only to
// the session that uploaded it. Photos stay in a private bucket; this route is
// the one way to see them.

type Context = { params: Promise<{ id: string; photoId: string }> };

/** Return the photo's bytes to the session that owns it. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id, photoId } = await params;
    if (!PHOTO_ID_PATTERN.test(photoId)) return fail(404, "Photo not found.");
    const photo = await readPhoto(await getSessionId(), id, photoId);
    if (photo === null) return fail(404, "Photo not found.");
    return new Response(Buffer.from(photo.data), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleError(error, "GET /api/businesses/[id]/photos/[photoId]");
  }
}
