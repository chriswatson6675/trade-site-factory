// Mission section 6: the database, not just application code, must
// guarantee that project_images.business_id / enquiry_images.business_id
// actually match their parent row's business_id. Inspects the migration
// SQL for the composite unique/foreign-key pair that enforces this — see
// test/migration-grants.test.ts for why text inspection, not a live query,
// is used here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coreSql = readFileSync(new URL('../supabase/migrations/20260829120100_core_schema.sql', import.meta.url), 'utf8');

test('84 projects has a composite unique(id, business_id) for project_images to reference', () => {
  const projectsTable = coreSql.slice(coreSql.indexOf('create table projects'), coreSql.indexOf('create table project_images'));
  assert.match(projectsTable, /unique\s*\(id,\s*business_id\)/);
});

test('85 project_images declares a composite foreign key to projects(id, business_id)', () => {
  const projectImagesTable = coreSql.slice(coreSql.indexOf('create table project_images'), coreSql.indexOf('create index project_images_project_idx'));
  assert.match(projectImagesTable, /foreign key \(project_id, business_id\) references projects\(id, business_id\)/);
  // and does NOT declare a separate single-column business_id FK that could disagree with the composite one
  assert.doesNotMatch(projectImagesTable, /business_id uuid not null references businesses/);
});

test('86 enquiries has a composite unique(id, business_id) for enquiry_images to reference', () => {
  const enquiriesTable = coreSql.slice(coreSql.indexOf('create table enquiries'), coreSql.indexOf('create table enquiry_images'));
  assert.match(enquiriesTable, /unique\s*\(id,\s*business_id\)/);
});

test('87 enquiry_images declares a composite foreign key to enquiries(id, business_id)', () => {
  const enquiryImagesTable = coreSql.slice(coreSql.indexOf('create table enquiry_images'), coreSql.indexOf('create index enquiry_images_enquiry_idx'));
  assert.match(enquiryImagesTable, /foreign key \(enquiry_id, business_id\) references enquiries\(id, business_id\)/);
  assert.doesNotMatch(enquiryImagesTable, /business_id uuid not null references businesses/);
});

test('88 both composite foreign keys cascade on delete, matching the single-column FKs they replace', () => {
  assert.match(coreSql, /foreign key \(project_id, business_id\) references projects\(id, business_id\) on delete cascade/);
  assert.match(coreSql, /foreign key \(enquiry_id, business_id\) references enquiries\(id, business_id\) on delete cascade/);
});
