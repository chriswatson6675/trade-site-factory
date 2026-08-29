-- Collision-safe "Q-1001" style enquiry reference allocation.
-- One counter row per business, incremented with a single atomic UPDATE so
-- concurrent submissions from different customers can never receive the
-- same reference (Postgres serialises UPDATEs against the same row).

create table enquiry_counters (
  business_id uuid primary key references businesses(id) on delete cascade,
  next_value integer not null default 1001
);

create or replace function allocate_enquiry_reference(p_business_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  insert into enquiry_counters (business_id, next_value)
  values (p_business_id, 1001)
  on conflict (business_id) do nothing;

  update enquiry_counters
  set next_value = next_value + 1
  where business_id = p_business_id
  returning next_value - 1 into v_value;

  if v_value is null then
    raise exception 'unknown business_id: %', p_business_id;
  end if;

  return 'Q-' || v_value;
end;
$$;

-- Only trusted server code (the service role, used exclusively in the
-- server-side /api/enquiries route) may allocate references.
revoke all on function allocate_enquiry_reference(uuid) from public, anon, authenticated;
