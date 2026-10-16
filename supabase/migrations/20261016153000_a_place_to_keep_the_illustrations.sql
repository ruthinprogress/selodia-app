-- A PLACE TO KEEP THE ILLUSTRATIONS.
--
-- PRIVATE, like every other bucket here, and for a different reason from the clips.
--
-- movement-demos is private because Exercise Animatic's licence forbids end users
-- reaching the raw files. These illustrations are Selodia's own, so no licence
-- compels it. It is private anyway because every bucket in this project is, because
-- flipping a private bucket public later is one line while un-publishing something
-- already scraped is not, and because the operational cost is small: the route signs
-- a URL with a long TTL and the phone caches the image.
--
-- If image loading ever proves slow enough to matter, making this bucket public is a
-- deliberate one-line change with no licence consequence. That is the whole argument,
-- written down so nobody has to reconstruct it.
--
-- BOTH MEDIA LIVE HERE. An animation is made FROM a still and belongs with it, so the
-- mp4 sits beside the png rather than in a bucket of its own.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'movement-illustrations',
  'movement-illustrations',
  false,
  26214400,
  array['image/png', 'video/mp4']
)
on conflict (id) do update
  set file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage policy is created on purpose. The bucket is unaddressable by the client,
-- exactly as movement-demos is; the only route to a file is through the API, signed by
-- the service role, after the caller has been authenticated.
