-- No storage policies for user roles on purpose. The server writes with the service
-- role, and browsers only upload to uploads-tmp through a signed URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  -- no HEIC
  ('uploads-tmp', 'uploads-tmp', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
  ('property-photos', 'property-photos', true, 5242880, array['image/webp']),
  ('blog-images', 'blog-images', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
