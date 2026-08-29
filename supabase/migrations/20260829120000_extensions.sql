-- Trade Site Factory: required Postgres extensions.
-- gen_random_uuid() is a native PostgreSQL 13+ built-in (pg_catalog), so it
-- needs no extension or schema qualification anywhere in this project.
-- pgcrypto is required only for digest() (SHA-256 hashing of claim/
-- confirmation tokens) — installed explicitly into the `extensions` schema,
-- matching how Supabase provisions a fresh project, so this migration is
-- deterministic rather than depending on whatever the default search_path
-- happens to be.
create extension if not exists pgcrypto with schema extensions;
