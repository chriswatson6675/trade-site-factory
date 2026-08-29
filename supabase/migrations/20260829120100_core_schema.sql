-- Trade Site Factory: core relational schema.
-- Supersedes the illustrative supabase/schema.sql — this migration set is the
-- source of truth. Tenant isolation is enforced by business_id everywhere and
-- by Row Level Security policies added in 20260829120300_rls_policies.sql.
--
-- Nothing in this migration set has ever been applied to a live project
-- (see BUILD-09 hardening pass), so it is edited in place as a clean
-- first-install chain rather than layering corrective migrations.

create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  trading_name text,
  trade_type text not null default 'scaffolding',
  phone text,
  whatsapp text,
  email text,
  base_town text,
  years_trading integer,
  site_status text not null default 'draft' check (site_status in ('draft', 'preview', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A Supabase Auth user must be explicitly linked to a business before they
-- can act as its owner. Membership is never inferred from a slug or from
-- simply being authenticated — the only sanctioned way to create a row
-- here is redeem_business_claim() (20260829120300_rls_policies.sql),
-- which requires a one-time, hashed, expiring claim token minted out of
-- band by scripts/create-claim-link.ts.
create table business_members (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on business_members(user_id);

-- MVP: exactly one owner per business, enforced at the database level (not
-- just in application code) — but scoped to role = 'owner' via a partial
-- index rather than a plain unique(business_id), so a future 'staff' (or
-- similar) role can be added to this same table later without requiring a
-- schema change here.
create unique index business_members_one_owner_per_business
  on business_members(business_id)
  where role = 'owner';

-- One-time, hashed, expiring tokens that hand a business to its owner.
-- The raw token is never stored — only its SHA-256 hash, computed
-- identically by scripts/create-claim-link.ts (Node crypto, out of band)
-- and by redeem_business_claim()'s use of pgcrypto's digest(). A public
-- business slug alone is never sufficient to obtain ownership.
create table business_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index business_claims_business_idx on business_claims(business_id);

create table services (
  id uuid primary key default gen_random_uuid(),
  trade_type text not null default 'scaffolding',
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (trade_type, slug)
);

create table business_services (
  business_id uuid not null references businesses(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, service_id)
);

create table service_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (business_id, slug)
);
create index service_areas_business_idx on service_areas(business_id);

create table projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  service_name text,
  title text not null,
  slug text not null,
  location text not null,
  description text not null default '',
  completed_on date,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug),
  -- lets project_images below declare a composite FK, so the database
  -- itself rejects an image row whose business_id doesn't match its
  -- project's actual business_id (mission section 6) — not just app code.
  unique (id, business_id)
);
create index projects_business_published_idx on projects(business_id, published);

create table project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  business_id uuid not null,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (project_id, business_id) references projects(id, business_id) on delete cascade
);
create index project_images_project_idx on project_images(project_id, sort_order);
create index project_images_business_idx on project_images(business_id);

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  quote text not null,
  customer_name text,
  location text,
  project_type text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index testimonials_business_idx on testimonials(business_id);

create table accreditations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  reference text,
  storage_path text,
  created_at timestamptz not null default now()
);
create index accreditations_business_idx on accreditations(business_id);

create table site_configurations (
  business_id uuid primary key references businesses(id) on delete cascade,
  template_key text not null default 'scaffolding-v1',
  published_at timestamptz,
  custom_domain text unique,
  updated_at timestamptz not null default now()
);

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  reference text not null,
  customer_name text not null,
  mobile text not null,
  email text,
  location text not null,
  preferred_contact text,
  work_type text not null,
  storeys text not null,
  access_areas text not null,
  width text not null,
  dimensions text,
  description text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  -- Pending vs confirmed submission state (mission section 4). A row is
  -- created here the moment phase 1 of a public enquiry submission
  -- durably persists it, but a NULL confirmed_at means it isn't a real
  -- enquiry yet as far as the owner is concerned — see
  -- 20260829120300_rls_policies.sql, where the owner SELECT policy (and
  -- transition_enquiry_status) both require confirmed_at is not null. A
  -- no-photo submission is confirmed immediately in the same insert; a
  -- submission with photos is only confirmed by confirm_pending_enquiry()
  -- once every reserved photo is verified to actually exist in Storage.
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reference),
  -- composite FK anchor for enquiry_images, same rationale as projects above.
  unique (id, business_id)
);
create index enquiries_business_status_idx on enquiries(business_id, status);
create index enquiries_business_created_idx on enquiries(business_id, created_at desc);
-- Lets the abandoned-pending cleanup script (scripts/cleanup-pending-enquiries.ts
-- — see supabase/SECURITY.md) find stale pending rows without a full scan.
create index enquiries_pending_created_idx on enquiries(created_at) where confirmed_at is null;

create table enquiry_images (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null,
  business_id uuid not null,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (enquiry_id, business_id) references enquiries(id, business_id) on delete cascade
);
create index enquiry_images_enquiry_idx on enquiry_images(enquiry_id, sort_order);
create index enquiry_images_business_idx on enquiry_images(business_id);

-- One confirmation capability per pending (photo-bearing) enquiry — the
-- enquiry's UUID alone is never sufficient to trigger the destructive
-- verify-or-rollback operation in confirm_pending_enquiry() (mission
-- section 6); the caller must also present the matching raw token, whose
-- hash is the only thing stored here. Deleted (via cascade) the moment the
-- enquiry is confirmed or rolled back, so a row's mere existence means
-- "still pending, still redeemable".
create table enquiry_confirmation_tokens (
  enquiry_id uuid primary key references enquiries(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now()
);

-- updated_at maintenance -----------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_set_updated_at before update on businesses
  for each row execute function set_updated_at();
create trigger projects_set_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger enquiries_set_updated_at before update on enquiries
  for each row execute function set_updated_at();
create trigger testimonials_set_updated_at before update on testimonials
  for each row execute function set_updated_at();
create trigger site_configurations_set_updated_at before update on site_configurations
  for each row execute function set_updated_at();
