# Security model — SECURITY DEFINER functions and RLS audit

Written for BUILD-09 (TRADE-SITE-FACTORY-SUPABASE-HARDENING-09), revised for
BUILD-10 (TRADE-SITE-FACTORY-PRE-LIVE-INTEGRITY-10) and again for BUILD-11
(TRADE-SITE-FACTORY-FIRST-LIVE-SYNC-11, the first live deployment). Re-run
this checklist after any future change to `supabase/migrations/`.

## Live migration state (BUILD-11)

The schema is no longer hypothetical — it is deployed.

**Applied and live.** These five migrations have been applied to the real
Trade Site Factory Supabase project and are now **immutable migration
history**:

`20260829120000_extensions.sql`, `20260829120100_core_schema.sql`,
`20260829120200_enquiry_reference.sql`, `20260829120300_rls_policies.sql`,
`20260829120400_storage_buckets.sql`.

**Never edit an applied migration.** Every schema correction from here on
ships as a NEW migration with a later timestamp. Editing an applied file
would silently desynchronise this repo from the live database while leaving
CI green, so `test/live-migration-state.test.ts` pins the SHA-256 of all
five; if that test fails, the fix is a new migration, never a re-pinned hash.

**First Security Advisor run.** The first live Supabase Security Advisor run
raised exactly one genuine warning — `function_search_path_mutable` for
`public.set_updated_at`, the one function we ship that had no explicit
`search_path` (it was missed because it is a plain trigger function rather
than a SECURITY DEFINER one). Fixed in
`20260829160000_harden_set_updated_at.sql`, which redefines it with
`set search_path = ''` and no behaviour change. The five existing triggers are
deliberately not recreated: `create or replace` preserves the function
identity they already point at.

**Findings that are intentional and must NOT be "fixed" to empty the
advisor:**

- **Tables with RLS enabled and no policies** — `business_claims`,
  `enquiry_counters`, `enquiry_confirmation_tokens`, and the write side of
  `business_members`. Deny-all is the design: these are reachable only
  through the guarded SECURITY DEFINER functions and the service role.
  Adding a policy to satisfy an advisor notice would *widen* the attack
  surface.
- **SECURITY DEFINER function notices** — every such function is inventoried
  below with its grants, its authentication check and its
  tenant-escalation check, and each is the single narrow audited gap in an
  otherwise fully RLS-enforced schema. They are internally authorised by
  design, not oversights.

## SECURITY DEFINER functions

Every function below is owned by the migration-applying role (`postgres` /
`supabase_admin` in a normal Supabase project), which has `BYPASSRLS`. That is
*why* they can read/write tables that RLS otherwise locks down for
`anon`/`authenticated` — each one is the single, narrow, audited gap in an
otherwise fully-RLS-enforced schema. None of them accept a `business_id`
(or an enquiry's parent business) directly from the caller as an unverified
trust boundary — every tenant check re-derives it from the row itself.

**search_path posture (BUILD-10):** every function below now uses
`set search_path = ''` (Supabase's current recommended posture, not the
`set search_path = public` BUILD-09 shipped) and fully qualifies every
object it touches — `public.<table>`, `extensions.digest(...)`, `auth.uid()`.
`pg_catalog` is always implicitly searched regardless of `search_path`, so
built-ins (`encode()`, `now()`, `coalesce()`, ...) never need qualification
— only extension-provided functions like pgcrypto's `digest()` do. pgcrypto
itself is installed explicitly `with schema extensions`
(`20260829120000_extensions.sql`), matching how Supabase provisions a fresh
project, so this is deterministic rather than depending on the default
search_path of whichever project this is eventually applied to. A function
that called another one of our own functions *unqualified* from inside a
`search_path = ''` body would fail outright the first time it ran — this
was caught and fixed in `transition_enquiry_status()`, which calls
`public.is_business_member(...)` and `public.is_legal_enquiry_transition(...)`,
not the bare names.

| Function | Grants | Auth check inside | Tenant-escalation check |
|---|---|---|---|
| `is_business_member(uuid)` | `anon, authenticated` (read-only helper used inside RLS policies themselves — policy predicates run under the caller's own search_path, not `search_path=''`, so this is the one place an unqualified call site outside these functions is fine) | N/A — pure predicate | Returns false for any business the caller isn't a member of |
| `allocate_enquiry_reference(uuid)` | `service_role` only (explicit `revoke` from `public`/`anon`/`authenticated`, then explicit `grant`) | N/A — only the trusted server (service role) can call it at all | `business_id` is a plain counter key; no cross-tenant read/write is possible through it |
| `redeem_business_claim(text)` | `authenticated` only | `if auth.uid() is null then raise exception` | Never trusts a slug or a `business_id` param — the token hash alone identifies the business; row-locked (`for update`) claim lookup + `business_members_one_owner_per_business` partial unique index make double-redemption impossible even under concurrency |
| `transition_enquiry_status(uuid, text)` | `authenticated` only | `if auth.uid() is null then raise exception` | Looks up the enquiry's *actual* `business_id` from the row itself, then requires `is_business_member(that business_id)` — owner A can never transition owner B's enquiry. **New in BUILD-10:** also refuses any enquiry where `confirmed_at is null` — a pending/unconfirmed enquiry does not exist yet as far as the owner (or this function) is concerned |
| `confirm_pending_enquiry(uuid, text)` **(new, BUILD-10)** | `service_role` only | N/A — only the trusted server can call it; the raw confirmation token itself is the authorisation (mission section 6: an enquiry UUID alone is never sufficient) | Row-locks the confirmation token (`for update`) before comparing hashes and before checking `confirmed_at`, so it can't be redeemed twice concurrently; deletes the token the instant it's consumed |
| `is_legal_enquiry_transition(text, text)` | inherits default (pure predicate, no table access — no meaningful escalation surface) | N/A | Stateless truth table only |
| `set_updated_at()` | N/A (trigger function, not `SECURITY DEFINER`, no direct grant surface, touches only `NEW`/`OLD`) | — | — (hardened in BUILD-11 with `set search_path = ''` — see *Live migration state* above; it was the sole genuine finding of the first live Security Advisor run) |

**Token comparison note:** `redeem_business_claim` and
`confirm_pending_enquiry` compare **hashes** (`token_hash = encode(extensions.digest(p_token,'sha256'),'hex')`),
never raw secrets, using plain SQL equality. This is the appropriate
approach here (mission section 6's "constant-time/appropriate
verification"): the comparison happens deep inside a single Postgres
statement reached only via a Vercel→Supabase network round trip from our
own server, where network jitter alone swamps any nanosecond-scale
timing difference a hash-equality check could leak — a genuine
remote-timing side channel is not a realistic threat model here, unlike
comparing a password directly.

## RLS re-audit (post BUILD-10)

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
| `enquiries` | **none** | SELECT own **AND `confirmed_at is not null`** — no UPDATE policy | **Changed in BUILD-10:** a pending (unconfirmed) enquiry is invisible to the owner even though it's their own business's row. Status changes go exclusively through `transition_enquiry_status()`, which also refuses pending rows; customer-submitted facts can never be rewritten by an owner at all |
| `enquiry_images` | **none** | SELECT own **AND parent enquiry `confirmed_at is not null`** | Same pending-is-invisible rule, applied via a join to the parent enquiry so it can't be bypassed by querying this table directly |
| `enquiry_counters` | none | none | Only `allocate_enquiry_reference()` (service role) touches it |
| `enquiry_confirmation_tokens` **(new, BUILD-10)** | none | none | Only `confirm_pending_enquiry()` (service role) touches it; the app additionally reads the hash (never the raw token) via the service role in `lib/data/enquiry-submission.ts` for a fast-fail check before attempting Storage verification |
| `storage.objects` (`project-images`) | SELECT only for photos of published projects | SELECT/INSERT/UPDATE/DELETE own path prefix | Bucket is private; public reads are signed URLs minted per-request by the anon-key server client, gated by this same policy |
| `storage.objects` (`enquiry-images`) | none | SELECT own path prefix only | No anon policy; uploads are via signed upload URL, not a standing INSERT grant |

**Cross-tenant checks confirmed:** every "own" policy above is
`is_business_member(business_id)` against `business_id` taken from the row
being accessed (or, for storage, decoded from the object's own path) —
never from a client-supplied parameter that could be swapped to another
tenant's id while keeping the caller's own session.

**Known gap acknowledged:** the RLS policies, the `redeem_business_claim`/
`confirm_pending_enquiry` concurrency guarantees, and
`transition_enquiry_status`'s cross-tenant and pending-state rejections are
only provable against a live Postgres instance. This repo has none
connected (see the BUILD-08/09/10 final reports), so `test/*.test.ts`
proves the *application-level* logic and, via migration-text inspection
(`test/migration-grants.test.ts`, `test/image-integrity.test.ts`), that the
SQL actually contains the guarantees described here — not a live
end-to-end proof. Re-run the concurrency/cross-tenant scenarios as
integration tests against a real (or local `supabase start`) project
before the first production launch.

## Pending vs confirmed enquiries (BUILD-10)

A photo-bearing public enquiry is created with `confirmed_at = null`
("pending") the moment phase 1 (`POST /api/enquiries`) durably persists it
— before the customer's browser has uploaded a single photo. It is
invisible to the owner (RLS above) and cannot be status-transitioned
(`transition_enquiry_status` above) until phase 2
(`POST /api/enquiries/confirm`) verifies every reserved photo actually
exists in Storage and calls `confirm_pending_enquiry()`, which atomically
sets `confirmed_at`. A no-photo submission has nothing left to verify and
is confirmed in the very same INSERT that creates it.

**Abandoned pending submissions:** a customer can legitimately close their
browser after phase 1 without ever reaching phase 2, leaving a pending
enquiry (and possibly some uploaded-but-unconfirmed Storage objects)
behind indefinitely. This build deliberately does **not** introduce any
cron/background infrastructure to clean these up (mission section 8).
Instead:

- `enquiries.created_at` (already indexed for `confirmed_at is null` via
  `enquiries_pending_created_idx`) is what "how old is this pending
  enquiry" is measured against.
- `scripts/cleanup-pending-enquiries.ts` is a manual maintenance script —
  run it by hand (`npm run cleanup:pending-enquiries [olderThanHours=48]`)
  — that finds pending enquiries older than the given interval, removes
  any Storage objects they reserved, then deletes the rows (cascading
  their `enquiry_images`/`enquiry_confirmation_tokens`).
- Before broad public launch, wire this same logic (or the script
  directly) into a real scheduler — Supabase Cron, Vercel Cron, or a
  GitHub Actions scheduled workflow are all reasonable choices — instead
  of relying on someone remembering to run it.
