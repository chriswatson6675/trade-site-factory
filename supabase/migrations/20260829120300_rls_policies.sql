-- Row Level Security. This migration is the actual security boundary — the
-- server-side /api/enquiries route additionally uses the service role key
-- (which bypasses RLS entirely) for the one deliberately-privileged write
-- path described in the mission brief; everything else goes through these
-- policies with the caller's own session.

alter table businesses enable row level security;
alter table business_members enable row level security;
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
-- only via the claim_unclaimed_business() SECURITY DEFINER function below,
-- never by a direct table write, so ownership can never be self-granted.
create policy "user can read own memberships"
  on business_members for select
  to authenticated
  using (user_id = auth.uid());

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
-- server-side validation. Owners may read and change status, but inserts
-- and deletes are intentionally left to the controlled server path only.
create policy "owner can read own enquiries"
  on enquiries for select
  to authenticated
  using (is_business_member(business_id));

create policy "owner can update own enquiries"
  on enquiries for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- enquiry_images -----------------------------------------------------------
create policy "owner can read own enquiry_images"
  on enquiry_images for select
  to authenticated
  using (is_business_member(business_id));

-- enquiry_counters -----------------------------------------------------------
-- No policies granted at all: only the SECURITY DEFINER
-- allocate_enquiry_reference() function (owned by the migration role) may
-- touch this table, so it stays invisible to anon/authenticated directly.

-- Bootstrap: claim an unowned business ---------------------------------
-- The only sanctioned way to create a business_members row. It requires an
-- authenticated user and only succeeds while the business has zero
-- members, so ownership is an explicit one-time action, never inferred
-- from knowing a slug.
create or replace function claim_unclaimed_business(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_member_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select id into v_business_id from businesses where slug = p_slug;
  if v_business_id is null then
    raise exception 'no business found for slug %', p_slug;
  end if;

  select count(*) into v_member_count from business_members where business_id = v_business_id;
  if v_member_count > 0 then
    raise exception 'business % already has an owner', p_slug;
  end if;

  insert into business_members (business_id, user_id, role)
  values (v_business_id, auth.uid(), 'owner');

  return v_business_id;
end;
$$;

grant execute on function claim_unclaimed_business(text) to authenticated;
grant execute on function is_business_member(uuid) to authenticated, anon;
