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

-- Explicit, not implicit: PostgreSQL grants EXECUTE on a new function to
-- PUBLIC by default, which every role (including service_role) inherits
-- unless revoked. BUILD-08 revoked from public/anon/authenticated but
-- never explicitly re-granted to service_role, which — once PUBLIC's
-- default grant is revoked — leaves the server-side /api/enquiries route
-- unable to call this function at all. Fixed here: revoke everything,
-- then grant only to the one role that should ever call it.
revoke all on function allocate_enquiry_reference(uuid) from public;
revoke all on function allocate_enquiry_reference(uuid) from anon;
revoke all on function allocate_enquiry_reference(uuid) from authenticated;
grant execute on function allocate_enquiry_reference(uuid) to service_role;
