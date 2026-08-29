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

const extensionsSql = read('migrations/20260829120000_extensions.sql');
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

test('76 every SECURITY DEFINER function sets search_path to the empty string (current Supabase guidance), not "public"', () => {
  const definerBlocks = [...rlsSql.matchAll(/security definer[\s\S]*?\$\$;/g)].map((m) => m[0]);
  assert.ok(definerBlocks.length >= 4, 'expected at least is_business_member, redeem_business_claim, transition_enquiry_status and confirm_pending_enquiry');
  definerBlocks.forEach((block) => {
    assert.match(block, /set search_path = ''/);
    assert.doesNotMatch(block, /set search_path = public\b/);
  });
});

test('118 pgcrypto is installed explicitly into the extensions schema', () => {
  assert.match(extensionsSql, /create extension if not exists pgcrypto with schema extensions/);
});

test('119 digest() is always called schema-qualified as extensions.digest — never bare — in every function body that uses it', () => {
  // Scoped to the two function bodies that actually call digest(), not the
  // whole file, so this doesn't get tripped up by prose mentioning
  // "digest()" in a comment (which is deliberately unqualified — comments
  // aren't SQL).
  const redeemBody = rlsSql.slice(rlsSql.indexOf('create or replace function redeem_business_claim'), rlsSql.indexOf('revoke all on function redeem_business_claim'));
  const confirmBody = rlsSql.slice(rlsSql.indexOf('create or replace function confirm_pending_enquiry'), rlsSql.indexOf('revoke all on function confirm_pending_enquiry'));
  for (const body of [redeemBody, confirmBody]) {
    const calls = [...body.matchAll(/[\w.]*digest\(/g)].map((m) => m[0]);
    assert.ok(calls.length >= 1, 'expected at least one digest() call in this function body');
    calls.forEach((call) => assert.equal(call, 'extensions.digest('));
  }
});

test('120 SECURITY DEFINER function bodies never call a sibling function of ours unqualified (would fail to resolve under search_path = \'\')', () => {
  // transition_enquiry_status calls is_business_member and is_legal_enquiry_transition.
  const transitionBody = rlsSql.slice(
    rlsSql.indexOf('create or replace function transition_enquiry_status'),
    rlsSql.indexOf('revoke all on function transition_enquiry_status'),
  );
  assert.match(transitionBody, /public\.is_business_member\(/);
  assert.match(transitionBody, /public\.is_legal_enquiry_transition\(/);
  assert.doesNotMatch(transitionBody, /[^.]\bis_business_member\(/); // no unqualified call sneaking in
  assert.doesNotMatch(transitionBody, /[^.]\bis_legal_enquiry_transition\(/);
});

test('121 confirm_pending_enquiry is explicitly granted to service_role only', () => {
  assert.match(rlsSql, /grant execute on function confirm_pending_enquiry\(uuid, text\) to service_role/);
  assert.match(rlsSql, /revoke all on function confirm_pending_enquiry\(uuid, text\) from public/);
  assert.match(rlsSql, /revoke all on function confirm_pending_enquiry\(uuid, text\) from anon/);
  assert.match(rlsSql, /revoke all on function confirm_pending_enquiry\(uuid, text\) from authenticated/);
  assert.doesNotMatch(rlsSql, /grant execute on function confirm_pending_enquiry\(uuid, text\) to (anon|authenticated|public)/);
});

test('77 no direct UPDATE policy exists for owners on enquiries — status changes must go through the RPC', () => {
  const enquiriesPolicySection = rlsSql.slice(rlsSql.indexOf('-- enquiries '), rlsSql.indexOf('-- enquiry_images'));
  assert.doesNotMatch(enquiriesPolicySection, /for update/i);
  assert.doesNotMatch(enquiriesPolicySection, /for all/i);
  assert.match(enquiriesPolicySection, /owner can read own confirmed enquiries/);
});

test('122 the owner enquiries SELECT policy requires confirmed_at is not null — a pending enquiry is invisible', () => {
  const enquiriesPolicySection = rlsSql.slice(rlsSql.indexOf('-- enquiries '), rlsSql.indexOf('-- enquiry_images'));
  assert.match(enquiriesPolicySection, /using \(is_business_member\(business_id\) and confirmed_at is not null\)/);
});

test('123 the owner enquiry_images SELECT policy requires the PARENT enquiry to be confirmed too', () => {
  const imagesPolicySection = rlsSql.slice(rlsSql.indexOf('-- enquiry_images '), rlsSql.indexOf('-- enquiry_counters'));
  assert.match(imagesPolicySection, /e\.confirmed_at is not null/);
});

test('124 transition_enquiry_status refuses a pending (unconfirmed) enquiry', () => {
  const transitionBody = rlsSql.slice(
    rlsSql.indexOf('create or replace function transition_enquiry_status'),
    rlsSql.indexOf('revoke all on function transition_enquiry_status'),
  );
  assert.match(transitionBody, /confirmed_at is null/);
  assert.match(transitionBody, /not yet confirmed/);
});

test('125 enquiry_confirmation_tokens stores only a hash, never the raw token, and has RLS enabled with no policies', () => {
  assert.match(coreSql, /create table enquiry_confirmation_tokens/);
  const tableBlock = coreSql.slice(coreSql.indexOf('create table enquiry_confirmation_tokens'));
  assert.match(tableBlock, /token_hash text not null/);
  assert.doesNotMatch(tableBlock.slice(0, 300), /raw_token|plain_token/);
  assert.match(rlsSql, /alter table enquiry_confirmation_tokens enable row level security/);
  assert.doesNotMatch(rlsSql, /on enquiry_confirmation_tokens for/);
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

test('154 (BUILD-14 regression guard) redeem_business_claim still creates the business_members row — unchanged, immutable history', () => {
  // redeem_business_claim() itself is in the already-applied, immutable
  // rls_policies.sql (test 130 in test/live-migration-state.test.ts pins its
  // hash) — this just documents/guards the one fact BUILD-14's welcome-email
  // flow depends on: a successful claim really does insert the membership
  // row that mark_welcome_email_sent() later updates.
  const body = rlsSql.slice(rlsSql.indexOf('create or replace function redeem_business_claim'), rlsSql.indexOf('revoke all on function redeem_business_claim'));
  assert.match(body, /insert into public\.business_members \(business_id, user_id, role\)/);
  assert.match(body, /values \(v_claim\.business_id, auth\.uid\(\), 'owner'\)/);
});
