-- Storage buckets and their Row Level Security.
--
-- project-images: PUBLIC. Once a project is published its photos are meant
-- to be public; paths are unguessable UUIDs
-- (businesses/{businessId}/projects/{projectId}/{uuid}.{ext}) generated
-- server/client-side only — never from a user-supplied filename.
--
-- enquiry-images: PRIVATE. Customer photos are never public. Uploads happen
-- only from the server-side /api/enquiries route with the service role key
-- (which bypasses these policies entirely); owners read them via signed
-- URLs, gated by the select policy below.

insert into storage.buckets (id, name, public)
values
  ('project-images', 'project-images', true),
  ('enquiry-images', 'enquiry-images', false)
on conflict (id) do nothing;

-- project-images: owner can manage only objects under their own business's
-- path prefix. (Public read is served by the bucket's public CDN URL and
-- does not go through these policies at all.)
create policy "owner can read own project-images objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'businesses'
    and is_business_member(((storage.foldername(name))[2])::uuid)
  );

create policy "owner can upload own project-images objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'businesses'
    and is_business_member(((storage.foldername(name))[2])::uuid)
  );

create policy "owner can update own project-images objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'businesses'
    and is_business_member(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'businesses'
    and is_business_member(((storage.foldername(name))[2])::uuid)
  );

create policy "owner can delete own project-images objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = 'businesses'
    and is_business_member(((storage.foldername(name))[2])::uuid)
  );

-- enquiry-images: owners may only ever SELECT (to mint signed URLs) their
-- own business's objects. No insert/update/delete policy for anon or
-- authenticated at all — every upload happens server-side with the
-- service role key, which bypasses RLS.
create policy "owner can read own enquiry-images objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'enquiry-images'
    and (storage.foldername(name))[1] = 'businesses'
    and is_business_member(((storage.foldername(name))[2])::uuid)
  );
