-- Storage buckets and their Row Level Security.
--
-- Both buckets are PRIVATE (BUILD-08 had project-images public — corrected
-- here: a public bucket serves objects to anyone with the URL regardless
-- of RLS, which conflicts with unpublished projects needing to stay
-- private). Public visitors instead get short-lived signed URLs, minted
-- per-request by the (force-dynamic) public pages using their own
-- anon-key session — see the storage.objects policy below — never the
-- service role.
--
-- Size/type limits are enforced by Postgres/Storage itself
-- (file_size_limit, allowed_mime_types), not only by application code, so
-- a client that lies about a file's declared size/type in
-- POST /api/enquiries still cannot get past the real bucket limits at
-- actual upload time.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-images', 'project-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']),
  ('enquiry-images', 'enquiry-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- project-images: public read, but only for photos of a published project
-- of a published business — mirrors the project_images table policy
-- exactly, so a signed URL can only ever be minted for a photo that's
-- meant to be public. Draft/unpublished project photos are not
-- retrievable by anon at all, by path or otherwise.
create policy "public can read images of published projects"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'project-images'
    and exists (
      select 1
      from project_images pi
      join projects p on p.id = pi.project_id
      join businesses b on b.id = p.business_id
      where pi.storage_path = storage.objects.name
        and p.published = true
        and b.site_status = 'published'
    )
  );

-- project-images: owner can manage only objects under their own business's
-- path prefix (businesses/{businessId}/projects/{projectId}/{uuid}.ext) —
-- this is also how the owner's browser uploads directly to Storage.
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
-- authenticated at all: every customer upload happens via a short-lived
-- signed *upload* URL that the service role mints server-side per object
-- (see app/api/enquiries) — that capability bypasses these policies for
-- exactly the one pre-authorised path it was issued for, so no standing
-- anon INSERT policy is ever needed (or granted).
create policy "owner can read own enquiry-images objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'enquiry-images'
    and (storage.foldername(name))[1] = 'businesses'
    and is_business_member(((storage.foldername(name))[2])::uuid)
  );
