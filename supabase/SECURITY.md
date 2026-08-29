# Security model — SECURITY DEFINER functions and RLS audit

Written for BUILD-09 (TRADE-SITE-FACTORY-SUPABASE-HARDENING-09). Re-run this
checklist after any future change to `supabase/migrations/`.

## SECURITY DEFINER functions

Every function below is owned by the migration-applying role (`postgres` /
`supabase_admin` in a normal Supabase project), which has `BYPASSRLS`. That is
*why* they can read/write tables that RLS otherwise locks down for
`anon`/`authenticated` — each one is the single, narrow, audited gap in an
otherwise fully-RLS-enforced schema. None of them accept a `business_id`
directly from the caller as an unverified trust boundary.

| Function | `search_path` set explicitly? | Grants | Auth check inside | Tenant-escalation check |
|---|---|---|---|---|
| `is_business_member(uuid)` | ✅ `public` | `anon, authenticated` (read-only helper used inside RLS policies themselves) | N/A — pure predicate | Returns false for any business the caller isn't a member of; used by every other policy/function below |
| `allocate_enquiry_reference(uuid)` | ✅ `public` | `service_role` only (explicit `revoke` from `public`/`anon`/`authenticated`, then explicit `grant`) | N/A — only the trusted server (service role) can call it at all | `business_id` is a plain counter key; no cross-tenant read/write is possible through it |
| `redeem_business_claim(text)` | ✅ `public` | `authenticated` only | `if auth.uid() is null then raise exception` | Never trusts a slug or a `business_id` param — the token hash alone identifies the business; row-locked (`for update`) claim lookup + `business_members_one_owner_per_business` partial unique index make double-redemption impossible even under concurrency |
| `transition_enquiry_status(uuid, text)` | ✅ `public` | `authenticated` only | `if auth.uid() is null then raise exception` | Looks up the enquiry's *actual* `business_id` from the row itself (never trusts a caller-supplied one), then requires `is_business_member(that business_id)` — so owner A can never transition owner B's enquiry no matter what `p_enquiry_id` they pass |
| `set_updated_at()` | N/A (trigger function, not `SECURITY DEFINER`, no direct grant surface) | invoked implicitly by triggers | — | — |

**Explicit vs. implicit privileges:** PostgreSQL grants `EXECUTE` on a newly
created function to `PUBLIC` by default. Every `SECURITY DEFINER` function
above ends with an explicit `revoke ... from public` followed by an explicit
`grant ... to <role>` — nothing here relies on the default. This is what
BUILD-08 got wrong for `allocate_enquiry_reference` (revoked from
`public`/`anon`/`authenticated` but never re-granted to `service_role`,
which would have made the enquiry route unable to call it at all); fixed in
`20260829120200_enquiry_reference.sql`.

## RLS re-audit (post-hardening)

| Table | Public (anon) | Authenticated owner | Notes |
|---|---|---|---|
| `businesses` | SELECT, `site_status = 'published'` only | SELECT/UPDATE own (`is_business_member`) | No public INSERT/DELETE ever |
| `business_members` | none | SELECT own row only | No INSERT/UPDATE/DELETE policy for anyone — only `redeem_business_claim()` writes here |
| `business_claims` | none | none | No policy at all in either direction — only the service-role admin script (insert) and `redeem_business_claim()` (select/update) ever touch it |
| `services` | SELECT (shared catalogue) | SELECT | Not tenant data |
| `business_services` | SELECT if business published | SELECT/ALL own | |
| `service_areas` | SELECT if business published | ALL own | |
| `projects` | SELECT if `published = true` and business published | ALL own | |
| `project_images` | SELECT if parent project+business published | ALL own | Table-level policy only gates Postgres reads; the matching `storage.objects` policy is what actually gates whether a photo's bytes/signed URL are obtainable |
| `testimonials`, `accreditations`, `site_configurations` | none | ALL own | Not in the current public UI — safest default until they are |
| `enquiries` | **none** | SELECT own only — **no UPDATE policy** | Status changes go exclusively through `transition_enquiry_status()`; customer-submitted facts (name/mobile/email/location/work/dimensions/description) can never be rewritten by an owner |
| `enquiry_images` | **none** | SELECT own only | No INSERT for anyone — customer uploads land here via signed upload URL + the service-role confirm step, not RLS |
| `enquiry_counters` | none | none | Only `allocate_enquiry_reference()` (service role) touches it |
| `storage.objects` (`project-images`) | SELECT only for photos of published projects | SELECT/INSERT/UPDATE/DELETE own path prefix | Bucket is private; public reads are signed URLs minted per-request by the anon-key server client, gated by this same policy |
| `storage.objects` (`enquiry-images`) | none | SELECT own path prefix only | No anon policy; uploads are via signed upload URL, not a standing INSERT grant |

**Cross-tenant checks confirmed:** every "own" policy above is
`is_business_member(business_id)` against `business_id` taken from the row
being accessed (or, for storage, decoded from the object's own path) — never
from a client-supplied parameter that could be swapped to another tenant's
id while keeping the caller's own session.

**Known gap acknowledged:** the RLS policies, the `redeem_business_claim`
concurrency guarantee, and `transition_enquiry_status`'s cross-tenant
rejection are only provable against a live Postgres instance. This repo has
none connected (see the BUILD-08/BUILD-09 final reports), so
`test/*.test.ts` proves the *application-level* logic and, via
migration-text inspection (`test/migration-grants.test.ts`,
`test/image-integrity.test.ts`), that the SQL actually contains the
guarantees described here — not a live end-to-end proof. Re-run the
concurrency/cross-tenant scenarios as integration tests against a real (or
local `supabase start`) project before the first production launch.
