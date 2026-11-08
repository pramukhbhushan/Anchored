-- =============================================================================
-- Post photos
-- =============================================================================
-- A private Storage bucket for the photos owners upload for a post, at
-- `<session>/<business>/<photo id>`. Only the service role reads or writes it;
-- the app serves each photo back to its own session through
-- `GET /api/businesses/[id]/photos/[photoId]`, so no Storage policy grants
-- anyone else access. The size and type limits match `lib/domain/photos.ts`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
