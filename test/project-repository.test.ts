import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publishProject } from '../lib/data/project-repository.ts';

type FakeCalls = { projects?: Record<string, unknown>; images?: Record<string, unknown>[] };

/** Minimal fake covering exactly the query-builder shape publishProject() calls — proves the write sequence without a live database. */
function createFakeClient(options: { failProjectImagesInsert?: boolean } = {}): {
  client: SupabaseClient;
  inserted: FakeCalls;
  uploaded: string[];
  removed: string[];
} {
  const inserted: FakeCalls = {};
  const uploaded: string[] = [];
  const removed: string[] = [];
  const fake = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          uploaded.push(path);
          return { error: null };
        },
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://fake.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=fake` })),
          error: null,
        }),
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { error: null };
        },
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
            if (options.failProjectImagesInsert) {
              return { error: { message: 'simulated project_images insert failure' } };
            }
            inserted.images = rows;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
  return { client: fake as unknown as SupabaseClient, inserted, uploaded, removed };
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

test('126 a failed project_images insert removes the already-uploaded Storage objects rather than leaving them orphaned', async () => {
  const { client, uploaded, removed } = createFakeClient({ failProjectImagesInsert: true });
  const files = [new File(['x'], 'a.jpg', { type: 'image/jpeg' }), new File(['y'], 'b.jpg', { type: 'image/jpeg' })];

  await assert.rejects(() => publishProject(client, 'biz-1', { service: 'Roofing access', location: 'Wrexham', description: '', files }));

  assert.equal(uploaded.length, 2);
  assert.deepEqual([...removed].sort(), [...uploaded].sort());
});
