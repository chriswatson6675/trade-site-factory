-- Row Level Security. This migration is the actual security boundary — the
-- server-side /api/enquiries route additionally uses the service role key
-- (which bypasses RLS entirely) for the one deliberately-privileged write
-- path described in the mission brief; everything else goes through these
-- policies with the caller's own session.
--
-- Every SECURITY DEFINER function below explicitly sets search_path (to
-- stop a caller from shadowing catalogue objects via a hostile search_path)
-- and is granted EXECUTE only to the specific role(s) that should ever call
-- it — nothing relies on PostgreSQL's default PUBLIC grant. See
-- supabase/SECURITY.md for the full audit.

alter table businesses enable row level security;
alter table business_members enable row level security;
alter table business_claims enable row level security;
alter table services enable row level security;
alter table business_services enable row level security;
alter table service_areas enable row level security;
alter table projects enable row level security;
alter table project_images enable row level security;
alter table testimonials enable row level security;
alter table accreditations enable row level security;
alter table site_configurations enable row level security;
alter table enquiries enable row level security;
alter table enquiry_images enable row level security;
alter table enquiry_counters enable row level security;

-- Helper: is the current user a member (owner) of a given business?
create or replace function is_business_member(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from business_members
    where business_id = p_business_id and user_id = auth.uid()
  );
$$;
revoke all on function is_business_member(uuid) from public;
grant execute on function is_business_member(uuid) to anon, authenticated;

-- businesses ------------------------------------------------------------
create policy "public can read published businesses"
  on businesses for select
  to anon, authenticated
  using (site_status = 'published');

create policy "owner can read own business"
  on businesses for select
  to authenticated
  using (is_business_member(id));

create policy "owner can update own business"
  on businesses for update
  to authenticated
  using (is_business_member(id))
  with check (is_business_member(id));

-- business_members --------------------------------------------------------
-- Deliberately no insert/update/delete policy: membership rows are created
-- only via redeem_business_claim() below, never by a direct table write,
-- so ownership can never be self-granted — not even from a valid slug.
create policy "user can read own memberships"
  on business_members for select
  to authenticated
  using (user_id = auth.uid());

-- business_claims -----------------------------------------------------------
-- No policies at all, for anon or authenticated: claims are created only
-- by the out-of-band admin script (scripts/create-claim-link.ts, using the
-- service role, which bypasses RLS) and consumed only by
-- redeem_business_claim() (SECURITY DEFINER, also bypasses RLS as its
-- owning role). Neither the raw token nor any claim metadata is ever
-- readable through the API.

-- services (shared catalogue, not tenant data) ---------------------------
create policy "anyone can read the service catalogue"
  on services for select
  to anon, authenticated
  using (true);

-- business_services ---------------------------------------------------------
create policy "public can read services of published businesses"
  on business_services for select
  to anon, authenticated
  using (exists (select 1 from businesses b where b.id = business_id and b.site_status = 'published'));

create policy "owner can read own business_services"
  on business_services for select
  to authenticated
  using (is_business_member(business_id));

create policy "owner can manage own business_services"
  on business_services for all
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- service_areas ------------------------------------------------------------
create policy "public can read areas of published businesses"
  on service_areas for select
  to anon, authenticated
  using (exists (select 1 from businesses b where b.id = business_id and b.site_status = 'published'));

create policy "owner can manage own service_areas"
  on service_areas for all
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- projects -------------------------------------------------------------
create policy "public can read published projects of published businesses"
  on projects for select
  to anon, authenticated
  using (
    published = true
    and exists (select 1 from businesses b where b.id = business_id and b.site_status = 'published')
  );

create policy "owner can manage own projects"
  on projects for all
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- project_images ---------------------------------------------------------
-- Table-level read policy for anon/authenticated Postgres queries. The
-- project-images bucket is now PRIVATE (20260829120400_storage_buckets.sql)
-- — the matching storage.objects policy in that file is what actually
-- gates whether a signed URL can be minted for a given photo.
create policy "public can read images of published projects"
  on project_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from projects p
      join businesses b on b.id = p.business_id
      where p.id = project_id and p.published = true and b.site_status = 'published'
    )
  );

create policy "owner can manage own project_images"
  on project_images for all
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- testimonials / accreditations / site_configurations --------------------
-- Not part of the current public UI; owner-only for now (safest default —
-- widen with an explicit public policy if/when they're surfaced publicly).
create policy "owner can manage own testimonials"
  on testimonials for all
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "owner can manage own accreditations"
  on accreditations for all
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "owner can manage own site_configurations"
  on site_configurations for all
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- enquiries ----------------------------------------------------------------
-- No anon policy at all: public submission goes exclusively through the
-- server-side /api/enquiries route using the service role key, after
-- server-side validation.
--
-- No owner UPDATE policy either (BUILD-08 had one — removed here). An
-- owner must never be able to rewrite a customer's submitted facts (name,
-- mobile, email, location, work description, dimensions, ...); the only
-- legitimate owner write is a status change, which now goes exclusively
-- through transition_enquiry_status() below.
create policy "owner can read own enquiries"
  on enquiries for select
  to authenticated
  using (is_business_member(business_id));

-- enquiry_images -----------------------------------------------------------
create policy "owner can read own enquiry_images"
  on enquiry_images for select
  to authenticated
  using (is_business_member(business_id));

-- enquiry_counters -----------------------------------------------------------
-- No policies granted at all: only the SECURITY DEFINER
-- allocate_enquiry_reference() function (owned by the migration role) may
-- touch this table, so it stays invisible to anon/authenticated directly.

-- Bootstrap: redeem a one-time business claim -----------------------------
-- The only sanctioned way to create a business_members row. Requires an
-- authenticated user and a valid, unused, unexpired claim token (see
-- business_claims above and scripts/create-claim-link.ts) — a business
-- slug alone is never sufficient. Row-locks the claim (`for update`) so
-- two concurrent redemptions of the same token cannot both succeed, and
-- relies additionally on business_members_one_owner_per_business (a
-- partial unique index) so even two *different* valid tokens minted for
-- the same business can never produce two owners.
create or replace function redeem_business_claim(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_hash text;
  v_claim record;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_claim
  from business_claims
  where token_hash = v_token_hash
  for update;

  if v_claim is null then
    raise exception 'invalid claim token';
  end if;
  if v_claim.used_at is not null then
    raise exception 'claim token already used';
  end if;
  if v_claim.expires_at < now() then
    raise exception 'claim token expired';
  end if;

  -- If another (different) token already claimed this business,
  -- business_members_one_owner_per_business raises a unique violation
  -- here and the whole function — including the used_at update below —
  -- rolls back, so this token is left unused rather than silently wasted.
  insert into business_members (business_id, user_id, role)
  values (v_claim.business_id, auth.uid(), 'owner');

  update business_claims set used_at = now() where id = v_claim.id;

  return v_claim.business_id;
end;
$$;

revoke all on function redeem_business_claim(text) from public;
revoke all on function redeem_business_claim(text) from anon;
grant execute on function redeem_business_claim(text) to authenticated;

-- Controlled enquiry status transitions ------------------------------------
-- Mirrors lib/domain's canTransition() truth table exactly (kept in sync
-- by test/enquiry-status.test.ts, which asserts both against this file's
-- text). The *only* way an owner may change status; there is no direct
-- UPDATE policy on enquiries for authenticated at all.
create or replace function is_legal_enquiry_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('new', 'contacted'), ('new', 'lost'),
    ('contacted', 'quoted'), ('contacted', 'lost'),
    ('quoted', 'won'), ('quoted', 'lost')
  );
$$;

create or replace function transition_enquiry_status(p_enquiry_id uuid, p_new_status text)
returns enquiries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enquiry enquiries;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_enquiry from enquiries where id = p_enquiry_id for update;
  if v_enquiry is null then
    raise exception 'unknown enquiry';
  end if;

  if not is_business_member(v_enquiry.business_id) then
    raise exception 'not authorised for this enquiry';
  end if;

  if not (p_new_status in ('new', 'contacted', 'quoted', 'won', 'lost')) then
    raise exception 'unknown status: %', p_new_status;
  end if;

  if not is_legal_enquiry_transition(v_enquiry.status, p_new_status) then
    raise exception 'cannot move an enquiry from % to %', v_enquiry.status, p_new_status;
  end if;

  update enquiries set status = p_new_status where id = p_enquiry_id
  returning * into v_enquiry;

  return v_enquiry;
end;
$$;

revoke all on function transition_enquiry_status(uuid, text) from public;
revoke all on function transition_enquiry_status(uuid, text) from anon;
grant execute on function transition_enquiry_status(uuid, text) to authenticated;
