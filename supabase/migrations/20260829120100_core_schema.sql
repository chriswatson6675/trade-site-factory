-- Trade Site Factory: core relational schema.
-- Supersedes the illustrative supabase/schema.sql — this migration set is the
-- source of truth. Tenant isolation is enforced by business_id everywhere and
-- by Row Level Security policies added in 20260829120300_rls_policies.sql.

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
-- simply being authenticated — see claim_unclaimed_business() in the RLS
-- migration for the only controlled way to create a row here from the app.
create table business_members (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on business_members(user_id);

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
  unique (business_id, slug)
);
create index projects_business_published_idx on projects(business_id, published);

create table project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  -- denormalised for cheap RLS/path checks without a join to projects
  business_id uuid not null references businesses(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index project_images_project_idx on project_images(project_id, sort_order);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reference)
);
create index enquiries_business_status_idx on enquiries(business_id, status);
create index enquiries_business_created_idx on enquiries(business_id, created_at desc);

create table enquiry_images (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index enquiry_images_enquiry_idx on enquiry_images(enquiry_id, sort_order);

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
