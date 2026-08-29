-- Demo/test data: "Dee Valley Scaffolding Ltd" (fictional).
-- Safe to run against a fresh project (local `supabase db reset`, or once
-- against a real project to get working demo data) — every insert is
-- guarded with on conflict / a not-exists check, so re-running it is a
-- no-op rather than a duplicate-data error.
--
-- This does NOT create the owner's business_members row: that happens the
-- first time a real person authenticates and calls claim_unclaimed_business
-- ('dee-valley-scaffolding') from the signed-in /owner flow, so ownership
-- is always an explicit action rather than something a migration grants.

insert into services (trade_type, name, slug) values
  ('scaffolding', 'Domestic scaffolding', 'domestic-scaffolding'),
  ('scaffolding', 'Commercial scaffolding', 'commercial-scaffolding'),
  ('scaffolding', 'Temporary roof', 'temporary-roof'),
  ('scaffolding', 'Roofing access', 'roofing-access')
on conflict (trade_type, slug) do nothing;

insert into businesses (id, slug, name, trading_name, trade_type, phone, whatsapp, email, base_town, years_trading, site_status)
values (
  '11111111-1111-4111-8111-111111111111',
  'dee-valley-scaffolding',
  'Dee Valley Scaffolding Ltd',
  'Dee Valley Scaffolding',
  'scaffolding',
  '01244 555 018',
  '447700900123',
  'hello@deevalley-demo.co.uk',
  'Chester',
  17,
  'published'
)
on conflict (slug) do nothing;

insert into business_services (business_id, service_id)
select b.id, s.id
from businesses b
join services s on s.trade_type = 'scaffolding'
  and s.slug in ('domestic-scaffolding', 'commercial-scaffolding', 'temporary-roof', 'roofing-access')
where b.slug = 'dee-valley-scaffolding'
on conflict do nothing;

insert into service_areas (business_id, name, slug)
select b.id, area.name, area.slug
from businesses b
cross join (values
  ('Chester', 'chester'),
  ('Wrexham', 'wrexham'),
  ('Mold', 'mold'),
  ('North Wales', 'north-wales')
) as area(name, slug)
where b.slug = 'dee-valley-scaffolding'
on conflict (business_id, slug) do nothing;

insert into projects (id, business_id, service_name, title, slug, location, description, published)
select b.id, b.id, p.service_name, p.title, p.slug, p.location, p.description, true
from businesses b
cross join (values
  ('00000000-0000-4000-8000-000000000000'::uuid, 'Temporary roof', 'Temporary Roof Scaffolding', 'temporary-roof-scaffolding-hoole-chester', 'Hoole, Chester', 'Temporary weather protection for a residential reroof.'),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Domestic scaffolding', 'Residential Access Scaffolding', 'residential-access-wrexham', 'Wrexham', 'Safe access for a home improvement project.'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Commercial scaffolding', 'Commercial Scaffolding', 'commercial-scaffolding-mold', 'Mold', 'Planned access for commercial works.')
) as p(id, service_name, title, slug, location, description)
where b.slug = 'dee-valley-scaffolding'
on conflict (business_id, slug) do nothing;

insert into site_configurations (business_id, template_key, published_at)
select id, 'scaffolding-v1', now() from businesses where slug = 'dee-valley-scaffolding'
on conflict (business_id) do nothing;

insert into enquiries (business_id, reference, customer_name, mobile, email, location, preferred_contact, work_type, storeys, access_areas, width, description, status)
select b.id, 'Q-1001', 'John Smith', '07700 900456', null, 'Chester', 'WhatsApp', 'Roofing', '2 storeys', 'Front + side', '5–10m', 'Roofers are replacing slate roof. Side access available.', 'new'
from businesses b
where b.slug = 'dee-valley-scaffolding'
on conflict (business_id, reference) do nothing;

insert into enquiry_counters (business_id, next_value)
select id, 1002 from businesses where slug = 'dee-valley-scaffolding'
on conflict (business_id) do nothing;
