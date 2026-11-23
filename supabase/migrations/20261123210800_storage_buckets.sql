-- Storage buckets. Deliberately NO policies on storage.objects for any user role:
-- with RLS on and no policies, anon and authenticated cannot list, upload, update
-- or delete. All writes are made by the server with the service role:
--   * the browser uploads raw photos to uploads-tmp through a signed upload URL
--     created by the server (the signed token authorises that single upload);
--   * the server validates, converts to WebP and writes to property-photos or
--     blog-images, then deletes the temporary file.
-- Public buckets serve files by public URL without any select policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  -- Raw uploads from phones; HEIC is not accepted.
  ('uploads-tmp', 'uploads-tmp', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
  -- Processed 1920px and 640px WebP files only.
  ('property-photos', 'property-photos', true, 5242880, array['image/webp']),
  ('blog-images', 'blog-images', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
