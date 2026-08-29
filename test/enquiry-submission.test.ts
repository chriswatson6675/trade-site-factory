import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { confirmEnquirySubmission, EnquirySubmissionError, startEnquirySubmission } from '../lib/data/enquiry-submission.ts';
import type { StartEnquiryInput } from '../lib/data/enquiry-submission.ts';

type BusinessRow = { id: string; slug: string; site_status: string };
type EnquiryRow = { id: string; business_id: string; reference: string; [key: string]: unknown };
type EnquiryImageRow = { enquiry_id: string; storage_path: string };

/** A small in-memory fake covering exactly the query/storage shapes lib/data/enquiry-submission.ts calls — proves the orchestration logic without a live database. */
function createFakeClient(businesses: BusinessRow[]) {
  const state = {
    businesses,
    enquiries: [] as EnquiryRow[],
    enquiryImages: [] as EnquiryImageRow[],
    counters: new Map<string, number>(),
    uploadedPaths: new Set<string>(),
  };
  let nextId = 1;

  const matches = <T extends Record<string, unknown>>(rows: T[], filters: Record<string, unknown>) =>
    rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));

  const eqChain = <T extends Record<string, unknown>>(rows: T[], filters: Record<string, unknown> = {}) => ({
    eq: (col: string, val: unknown) => eqChain(rows, { ...filters, [col]: val }),
    then: (resolve: (value: { data: T[]; error: null }) => void) => resolve({ data: matches(rows, filters), error: null }),
    maybeSingle: async () => ({ data: matches(rows, filters)[0] ?? null, error: null }),
    single: async () => {
      const row = matches(rows, filters)[0];
      return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
    },
  });

  const client = {
    from(table: string) {
      if (table === 'businesses') {
        return { select: () => eqChain(state.businesses) };
      }
      if (table === 'enquiries') {
        return {
          select: () => eqChain(state.enquiries),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = { id: `enq-${nextId++}`, ...payload } as EnquiryRow;
                state.enquiries.push(row);
                return { data: { id: row.id }, error: null };
              },
            }),
          }),
          delete: () => ({
            eq: (col: string, val: unknown) => {
              const removed = matches(state.enquiries, { [col]: val });
              state.enquiries = state.enquiries.filter((row) => row[col as keyof EnquiryRow] !== val);
              removed.forEach((row) => {
                state.enquiryImages = state.enquiryImages.filter((image) => image.enquiry_id !== row.id);
              });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'enquiry_images') {
        return {
          select: () => eqChain(state.enquiryImages),
          insert: (payload: EnquiryImageRow) => {
            state.enquiryImages.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    rpc: async (fn: string, args: { p_business_id: string }) => {
      if (fn !== 'allocate_enquiry_reference') throw new Error(`unexpected rpc: ${fn}`);
      const next = state.counters.get(args.p_business_id) ?? 1001;
      state.counters.set(args.p_business_id, next + 1);
      return { data: `Q-${next}`, error: null };
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({ data: { token: `token-${path}`, signedUrl: `https://fake/${path}?upload` }, error: null }),
        createSignedUrl: async (path: string) => (state.uploadedPaths.has(path) ? { data: { signedUrl: `https://fake/${path}` }, error: null } : { data: null, error: { message: 'not found' } }),
        remove: async (paths: string[]) => {
          paths.forEach((path) => state.uploadedPaths.delete(path));
          return { error: null };
        },
      }),
    },
  };

  return { client: client as unknown as SupabaseClient, state };
}

const baseInput = (overrides: Partial<StartEnquiryInput> = {}): StartEnquiryInput => ({
  businessSlug: 'dee-valley-scaffolding',
  customerName: 'John Smith',
  mobile: '07700 900456',
  location: 'Chester',
  workType: 'Roofing',
  storeys: '2 storeys',
  accessAreas: 'Front + side',
  width: '5–10m',
  description: 'Roof replacement.',
  photos: [],
  ...overrides,
});

test('67 an unpublished business is rejected before anything is persisted', async () => {
  const { client, state } = createFakeClient([{ id: 'biz-1', slug: 'draft-biz', site_status: 'draft' }]);
  await assert.rejects(
    () => startEnquirySubmission(client, baseInput({ businessSlug: 'draft-biz' })),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 404,
  );
  assert.equal(state.enquiries.length, 0);
});

test('68 a zero-photo submission completes immediately with a reference', async () => {
  const { client } = createFakeClient([{ id: 'biz-1', slug: 'dee-valley-scaffolding', site_status: 'published' }]);
  const result = await startEnquirySubmission(client, baseInput());
  assert.equal(result.status, 'complete');
  if (result.status === 'complete') assert.match(result.reference, /^Q-\d+$/);
});

test('69 a submission with photos reserves one upload slot per photo and stays pending', async () => {
  const { client, state } = createFakeClient([{ id: 'biz-1', slug: 'dee-valley-scaffolding', site_status: 'published' }]);
  const result = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }, { mimeType: 'image/png', size: 2000 }] }));
  assert.equal(result.status, 'pending-uploads');
  if (result.status === 'pending-uploads') {
    assert.equal(result.uploads.length, 2);
    assert.equal(state.enquiryImages.length, 2);
  }
});

test('70 confirming after every photo actually uploaded reports success', async () => {
  const { client, state } = createFakeClient([{ id: 'biz-1', slug: 'dee-valley-scaffolding', site_status: 'published' }]);
  const started = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }] }));
  assert.equal(started.status, 'pending-uploads');
  if (started.status !== 'pending-uploads') return;
  state.uploadedPaths.add(started.uploads[0].path); // simulate the browser's direct upload succeeding

  const result = await confirmEnquirySubmission(client, started.enquiryId);
  assert.equal(result.status, 'complete');
  assert.equal(result.reference, started.reference);
});

test('71 a submission is never reported successful when a required photo failed to persist, and is rolled back', async () => {
  const { client, state } = createFakeClient([{ id: 'biz-1', slug: 'dee-valley-scaffolding', site_status: 'published' }]);
  const started = await startEnquirySubmission(
    client,
    baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }, { mimeType: 'image/jpeg', size: 1000 }] }),
  );
  assert.equal(started.status, 'pending-uploads');
  if (started.status !== 'pending-uploads') return;
  state.uploadedPaths.add(started.uploads[0].path); // only the first of two photos actually made it

  await assert.rejects(
    () => confirmEnquirySubmission(client, started.enquiryId),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 422,
  );

  // rolled back: the enquiry (and its reserved image rows) are gone, and the one object that did upload was cleaned up.
  assert.equal(state.enquiries.length, 0);
  assert.equal(state.enquiryImages.length, 0);
  assert.equal(state.uploadedPaths.has(started.uploads[0].path), false);
});

test('72 confirming an unknown enquiry id fails clearly rather than silently succeeding', async () => {
  const { client } = createFakeClient([{ id: 'biz-1', slug: 'dee-valley-scaffolding', site_status: 'published' }]);
  await assert.rejects(
    () => confirmEnquirySubmission(client, 'does-not-exist'),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 404,
  );
});
