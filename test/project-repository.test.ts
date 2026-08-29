import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publishProject } from '../lib/data/project-repository.ts';

type FakeCalls = { projects?: Record<string, unknown>; images?: Record<string, unknown>[] };

/** Minimal fake covering exactly the query-builder shape publishProject() calls — proves the write sequence without a live database. */
function createFakeClient(): { client: SupabaseClient; inserted: FakeCalls } {
  const inserted: FakeCalls = {};
  const fake = {
    storage: {
      from: (bucket: string) => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
    from: (table: string) => {
      if (table === 'projects') {
        return {
          insert: (payload: Record<string, unknown>) => {
            inserted.projects = payload;
            return { select: () => ({ single: async () => ({ data: payload, error: null }) }) };
          },
        };
      }
      if (table === 'project_images') {
        return {
          insert: async (rows: Record<string, unknown>[]) => {
            inserted.images = rows;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
  return { client: fake as unknown as SupabaseClient, inserted };
}

test('55 publishing a job uploads photos, inserts a published project row, and links the image rows', async () => {
  const { client, inserted } = createFakeClient();
  const file = new File(['x'], 'front.jpg', { type: 'image/jpeg' });

  const project = await publishProject(client, 'biz-1', { service: 'Roofing access', location: 'Wrexham', description: '', files: [file] });

  assert.equal(project.published, true);
  assert.equal(project.service, 'Roofing access');
  assert.equal(project.images.length, 1);
  assert.equal(inserted.projects?.business_id, 'biz-1');
  assert.equal(inserted.projects?.published, true);
  assert.equal(inserted.images?.length, 1);
  assert.equal(inserted.images?.[0]?.business_id, 'biz-1');
});

test('56 publishing without a description falls back to a generated summary', async () => {
  const { client, inserted } = createFakeClient();
  await publishProject(client, 'biz-1', { service: 'Temporary roof', location: 'Chester', description: '', files: [] });
  assert.match(String(inserted.projects?.description), /Completed temporary roof in Chester/);
});

test('57 a job published with no photos inserts no project_images rows', async () => {
  const { client, inserted } = createFakeClient();
  const project = await publishProject(client, 'biz-1', { service: 'Domestic scaffolding', location: 'Mold', description: 'Access scaffold.', files: [] });
  assert.equal(project.images.length, 0);
  assert.equal(inserted.images, undefined);
});
