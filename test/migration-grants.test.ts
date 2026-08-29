// Migration-level assertions: there is no live Postgres connected to this
// repo (see the BUILD-08/BUILD-09 final reports), so these tests inspect
// the actual migration SQL text for the privilege/security properties
// described in supabase/SECURITY.md — a practical stand-in for a live
// integration test, not a substitute for running the real scenarios
// against a live/local Supabase project before production launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath: string) => readFileSync(new URL(`../supabase/${relativePath}`, import.meta.url), 'utf8');

const referenceSql = read('migrations/20260829120200_enquiry_reference.sql');
const rlsSql = read('migrations/20260829120300_rls_policies.sql');
const storageSql = read('migrations/20260829120400_storage_buckets.sql');
const coreSql = read('migrations/20260829120100_core_schema.sql');

test('73 allocate_enquiry_reference is explicitly granted to service_role only', () => {
  assert.match(referenceSql, /grant execute on function allocate_enquiry_reference\(uuid\) to service_role/);
  assert.match(referenceSql, /revoke all on function allocate_enquiry_reference\(uuid\) from public/);
  assert.match(referenceSql, /revoke all on function allocate_enquiry_reference\(uuid\) from anon/);
  assert.match(referenceSql, /revoke all on function allocate_enquiry_reference\(uuid\) from authenticated/);
  // and never re-granted to anon/authenticated after the revoke
  assert.doesNotMatch(referenceSql, /grant execute on function allocate_enquiry_reference\(uuid\) to (anon|authenticated|public)/);
});

test('74 redeem_business_claim is granted to authenticated only, never anon/public', () => {
  assert.match(rlsSql, /grant execute on function redeem_business_claim\(text\) to authenticated/);
  assert.doesNotMatch(rlsSql, /grant execute on function redeem_business_claim\(text\) to (anon|public)/);
});

test('75 transition_enquiry_status is granted to authenticated only, never anon/public', () => {
  assert.match(rlsSql, /grant execute on function transition_enquiry_status\(uuid, text\) to authenticated/);
  assert.doesNotMatch(rlsSql, /grant execute on function transition_enquiry_status\(uuid, text\) to (anon|public)/);
});

test('76 every SECURITY DEFINER function sets an explicit search_path', () => {
  const definerBlocks = [...rlsSql.matchAll(/security definer[\s\S]*?\$\$;/g)].map((m) => m[0]);
  assert.ok(definerBlocks.length >= 3, 'expected at least is_business_member, redeem_business_claim and transition_enquiry_status');
  definerBlocks.forEach((block) => assert.match(block, /set search_path = public/));
});

test('77 no direct UPDATE policy exists for owners on enquiries — status changes must go through the RPC', () => {
  const enquiriesPolicySection = rlsSql.slice(rlsSql.indexOf('-- enquiries '), rlsSql.indexOf('-- enquiry_images'));
  assert.doesNotMatch(enquiriesPolicySection, /for update/i);
  assert.doesNotMatch(enquiriesPolicySection, /for all/i);
  assert.match(enquiriesPolicySection, /owner can read own enquiries/);
});

test('78 the claim flow requires an authenticated user and rejects a used/expired token, in the SQL itself', () => {
  assert.match(rlsSql, /if auth\.uid\(\) is null then\s*\n\s*raise exception 'authentication required'/);
  assert.match(rlsSql, /already used/);
  assert.match(rlsSql, /expired/);
  assert.match(rlsSql, /for update/); // row-locks the claim before checking/using it
});

test('79 business_members enforces at most one owner per business at the database level', () => {
  assert.match(coreSql, /create unique index business_members_one_owner_per_business/);
  assert.match(coreSql, /where role = 'owner'/);
});

test('80 business_claims never stores the raw token, only its hash, and has an expiry column', () => {
  assert.match(coreSql, /create table business_claims/);
  assert.match(coreSql, /token_hash text unique not null/);
  assert.match(coreSql, /expires_at timestamptz not null/);
  assert.match(coreSql, /used_at timestamptz/);
  assert.doesNotMatch(coreSql, /raw_token|plain_token/);
});

test('81 both Storage buckets are private, with explicit size and mime-type limits', () => {
  assert.match(storageSql, /'project-images',\s*'project-images',\s*false,\s*10485760/);
  assert.match(storageSql, /'enquiry-images',\s*'enquiry-images',\s*false,\s*10485760/);
  assert.match(storageSql, /allowed_mime_types/);
});

test('82 anon has no insert/update/delete storage policy on enquiry-images — only a scoped owner SELECT', () => {
  const enquirySection = storageSql.slice(storageSql.indexOf("bucket_id = 'enquiry-images'") - 400);
  assert.doesNotMatch(enquirySection, /for insert/i);
  assert.doesNotMatch(enquirySection, /for update/i);
  assert.doesNotMatch(enquirySection, /for delete/i);
});

test('83 the transition function truth table matches lib/domain\'s canTransition exactly', async () => {
  const { canTransition } = await import('../lib/domain/index.ts');
  const statuses = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
  const sqlPairs = new Set(
    [...rlsSql.matchAll(/\('(\w+)',\s*'(\w+)'\)/g)]
      .map((m) => `${m[1]}->${m[2]}`)
      .filter((pair) => statuses.includes(pair.split('->')[0] as (typeof statuses)[number])),
  );
  for (const from of statuses) {
    for (const to of statuses) {
      if (from === to) continue;
      const expected = canTransition(from, to);
      const inSql = sqlPairs.has(`${from}->${to}`);
      assert.equal(inSql, expected, `transition ${from} -> ${to}: SQL says ${inSql}, canTransition says ${expected}`);
    }
  }
});
