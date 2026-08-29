-- BUILD-11 (TRADE-SITE-FACTORY-FIRST-LIVE-SYNC-11).
--
-- The first five migrations in this directory have been applied to the live
-- Trade Site Factory project and are now immutable migration history: any
-- schema correction from here on ships as a NEW migration, never as an edit
-- to an applied file. This is the first such correction.
--
-- The first live Supabase Security Advisor run raised exactly one genuine
-- warning: `function_search_path_mutable` for `public.set_updated_at`. It was
-- created in 20260829120100_core_schema.sql without a `search_path` setting,
-- so it inherits whatever search_path the *calling* session happens to have.
-- Every other function we ship already pins `set search_path = ''`
-- (see supabase/SECURITY.md); this one was missed because it is a plain
-- trigger function rather than a SECURITY DEFINER one.
--
-- Behaviour is deliberately unchanged: the function still only stamps
-- NEW.updated_at with now(). `now()` lives in pg_catalog, which Postgres
-- always searches implicitly regardless of `search_path`, so nothing in this
-- body needs schema-qualification for it to resolve under `search_path = ''`.
--
-- `create or replace` keeps the function's identity (same name, same empty
-- argument list, same `trigger` return type), so the five existing
-- `..._set_updated_at` triggers in 20260829120100_core_schema.sql keep
-- pointing at it and are intentionally NOT recreated here.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
