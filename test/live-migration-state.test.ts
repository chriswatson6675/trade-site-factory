// BUILD-11 (TRADE-SITE-FACTORY-FIRST-LIVE-SYNC-11).
//
// The first five migrations under supabase/migrations/ have been applied to
// the live Trade Site Factory Supabase project, so this file guards the two
// rules that only start applying once a schema is live:
//
//   1. an applied migration is immutable — corrections ship as NEW migrations
//   2. the seed file has to actually produce the demo data we claim it does
//
// Like test/migration-grants.test.ts these are text/hash assertions over the
// SQL rather than live-database assertions (this repo has no Postgres
// connected), which is exactly why they are worth having: nothing else in CI
// would notice an edit to an already-applied migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (relativePath: string) =>
  readFileSync(new URL(`../supabase/${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const seedSql = read('seed.sql');
const hardenSql = read('migrations/20260829160000_harden_set_updated_at.sql');
const welcomeEmailMigrationSql = read('migrations/20260829180000_owner_welcome_email.sql');

/** The single SQL statement that begins with `prefix`, up to and including its terminating `;`. */
const statement = (sql: string, prefix: string) => {
  const start = sql.indexOf(prefix);
  assert.notEqual(start, -1, `expected seed.sql to contain a statement starting "${prefix}"`);
  return sql.slice(start, sql.indexOf(';', start) + 1);
};

/** Split a comma-separated SQL list, ignoring commas inside '...' string literals. */
const splitTopLevel = (list: string) => {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  for (const char of list) {
    if (char === "'") inString = !inString;
    if (char === ',' && !inString) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
};

test('127 the seeded projects take their id from the values list (p.id), not from the business (b.id)', () => {
  const projectsInsert = statement(seedSql, 'insert into projects (');
  const columns = splitTopLevel(projectsInsert.slice(projectsInsert.indexOf('(') + 1, projectsInsert.indexOf(')')));
  assert.equal(columns[0], 'id');
  assert.equal(columns[1], 'business_id');

  const selectList = projectsInsert.slice(projectsInsert.indexOf('select ') + 'select '.length, projectsInsert.indexOf('\nfrom '));
  const selected = splitTopLevel(selectList);
  // The live-seeding bug: `select b.id, b.id, ...` inserted the business id as
  // the project id, so all three demo projects collided on one primary key.
  assert.equal(selected[0], 'p.id', 'project id must come from the values list, not the business row');
  assert.equal(selected[1], 'b.id');
  assert.doesNotMatch(projectsInsert, /select b\.id, b\.id/);

  // ...and the values alias must actually expose an `id` column for p.id to resolve.
  assert.match(projectsInsert, /\) as p\(id,/);
});

test('128 the seeded Q-1001 enquiry is confirmed, so it is visible to the owner under the BUILD-10 RLS rules', () => {
  const enquiriesInsert = statement(seedSql, 'insert into enquiries (');
  const columns = splitTopLevel(enquiriesInsert.slice(enquiriesInsert.indexOf('(') + 1, enquiriesInsert.indexOf(')')));
  const selected = splitTopLevel(
    enquiriesInsert.slice(enquiriesInsert.indexOf('select ') + 'select '.length, enquiriesInsert.indexOf('\nfrom ')),
  );

  assert.equal(columns.length, selected.length, 'column list and select list must have the same arity');

  const confirmedAtIndex = columns.indexOf('confirmed_at');
  assert.notEqual(confirmedAtIndex, -1, 'seeded enquiry must set confirmed_at — a pending enquiry is invisible to the owner');
  assert.equal(selected[confirmedAtIndex], 'now()');

  // Guard the reference too, so this stays pinned to the demo enquiry we mean.
  assert.equal(selected[columns.indexOf('reference')], "'Q-1001'");
});

test('129 set_updated_at is redefined with an explicit, safe search_path in the new migration', () => {
  assert.match(hardenSql, /create or replace function public\.set_updated_at\(\)/);
  assert.match(hardenSql, /set search_path = ''/);
  assert.doesNotMatch(hardenSql, /set search_path = public\b/);
  // Behaviour must be unchanged: still just stamps updated_at.
  assert.match(hardenSql, /new\.updated_at = now\(\)/);
  // Triggers are deliberately not recreated — `create or replace` keeps the identity.
  assert.doesNotMatch(hardenSql, /create trigger/i);
});

test('130 the six real migrations already applied to the live project are unmodified', () => {
  // Applied migrations are immutable history: if one of these hashes fails,
  // the fix is a NEW migration, not an edit — never re-point these hashes at
  // edited content to make the test pass.
  const appliedMigrations: ReadonlyArray<readonly [string, string]> = [
    ['20260829120000_extensions.sql', 'bcf5a8d5fa0b1defb800d6bac0b71952790b7d5bd0a0fbcc2ee240898d254ef9'],
    ['20260829120100_core_schema.sql', 'd611fac0fc945616b3710e000447e1046b4516e8653ce2176221c18fab8e2f74'],
    ['20260829120200_enquiry_reference.sql', 'bcd6028121bbec84230dd827d552dc8f61015aab592ac6f40f813a554e9db599'],
    ['20260829120300_rls_policies.sql', '365156882093c4f7c76cd0ca227684a8368d88af4da7a46ed9c68e380b66cbf1'],
    ['20260829120400_storage_buckets.sql', '6a4e9f5ec3d0b1d26c0817cc3f8d2c28753b943e4737458d9f892f7ae0b43dbc'],
    ['20260829160000_harden_set_updated_at.sql', '30676db8d1d8438458d2db947f2e042bd570c850b6c6ea2667b61a1a0eaa919a'],
  ];

  for (const [name, expectedHash] of appliedMigrations) {
    const actual = createHash('sha256').update(read(`migrations/${name}`)).digest('hex');
    assert.equal(actual, expectedHash, `${name} has been modified since it was applied to the live project`);
  }
});

test('131 the migration-history repair marker exists and is a genuine no-op (comments only)', () => {
  // 20260829170233 is a bookkeeping entry Supabase recorded when the live
  // migration-history table was repaired to match this repo (the first
  // migrations were applied via the management API, which assigned its own
  // remote timestamps, and an accidental seed entry was removed). The schema
  // was never changed. This file exists only so local Git history matches
  // remote one-for-one — so it must never grow an executable statement.
  const marker = read('migrations/20260829170233_repair_migration_history_to_repo.sql');
  assert.ok(marker.trim().length > 0, 'marker migration must exist and not be empty');

  const executableLines = marker
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--'));
  assert.deepEqual(executableLines, [], 'the marker migration must contain no executable SQL — comments only');

  // Guard against anything executable hiding outside a comment. Prose inside
  // the comments legitimately contains semicolons, so strip the comments
  // first rather than scanning the raw text.
  const stripped = marker.replace(/--.*$/gm, '');
  assert.doesNotMatch(stripped, /\$\$/, 'no function bodies hiding statements');
  assert.doesNotMatch(stripped, /;/, 'no statement terminators outside comments');
  assert.equal(stripped.trim(), '', 'nothing at all survives comment-stripping');
});

// BUILD-14 (TRADE-SITE-FACTORY-OWNER-HANDOFF-UX-14): the new welcome-email
// migration is authored and content-checked here — same as test 129 was for
// harden_set_updated_at — but deliberately NOT yet added to test 130's
// hash-pinned "already applied" list. It only earns that pin once it's
// actually confirmed live, exactly as harden_set_updated_at was pinned in a
// later build than the one that introduced it.

test('146 welcome_email_sent_at is added to business_members, not a new table', () => {
  assert.match(welcomeEmailMigrationSql, /alter table business_members add column welcome_email_sent_at timestamptz/);
});

test('147 mark_welcome_email_sent has an explicit safe search_path and an auth check', () => {
  const body = welcomeEmailMigrationSql.slice(
    welcomeEmailMigrationSql.indexOf('create or replace function mark_welcome_email_sent'),
  );
  assert.match(body, /set search_path = ''/);
  assert.doesNotMatch(body, /set search_path = public\b/);
  assert.match(body, /if auth\.uid\(\) is null then\s*\n\s*raise exception 'authentication required'/);
});

test('148 mark_welcome_email_sent can only ever touch the caller\'s own membership row for the given business', () => {
  const body = welcomeEmailMigrationSql.slice(
    welcomeEmailMigrationSql.indexOf('create or replace function mark_welcome_email_sent'),
  );
  assert.match(body, /where business_id = p_business_id\s*\n\s*and user_id = auth\.uid\(\)/);
  // The is-null guard is what makes a repeat call a genuine no-op rather
  // than needing separate locking for the retry case.
  assert.match(body, /and welcome_email_sent_at is null/);
});

test('149 mark_welcome_email_sent is granted to authenticated only, never anon/public', () => {
  assert.match(welcomeEmailMigrationSql, /grant execute on function mark_welcome_email_sent\(uuid\) to authenticated/);
  assert.doesNotMatch(welcomeEmailMigrationSql, /grant execute on function mark_welcome_email_sent\(uuid\) to (anon|public)/);
  assert.match(welcomeEmailMigrationSql, /revoke all on function mark_welcome_email_sent\(uuid\) from public/);
  assert.match(welcomeEmailMigrationSql, /revoke all on function mark_welcome_email_sent\(uuid\) from anon/);
});
