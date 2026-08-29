import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { confirmEnquirySubmission, EnquirySubmissionError, startEnquirySubmission } from '../lib/data/enquiry-submission.ts';
import type { StartEnquiryInput } from '../lib/data/enquiry-submission.ts';
import { hashSecureToken } from '../lib/secure-token.ts';

type BusinessRow = { id: string; slug: string; site_status: string };
type EnquiryRow = { id: string; business_id: string; reference: string; confirmed_at: string | null; [key: string]: unknown };
type EnquiryImageRow = { enquiry_id: string; storage_path: string };
type ConfirmationTokenRow = { enquiry_id: string; token_hash: string };

/** A small in-memory fake covering exactly the query/storage/rpc shapes lib/data/enquiry-submission.ts calls — proves the orchestration logic (and confirm_pending_enquiry's real semantics) without a live database. */
function createFakeClient(businesses: BusinessRow[], options: { failImageInsertAt?: number } = {}) {
  const state = {
    businesses,
    enquiries: [] as EnquiryRow[],
    enquiryImages: [] as EnquiryImageRow[],
    confirmationTokens: [] as ConfirmationTokenRow[],
    counters: new Map<string, number>(),
    uploadedPaths: new Set<string>(),
  };
  let nextId = 1;
  let imageInsertCount = 0;

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
                state.confirmationTokens = state.confirmationTokens.filter((token) => token.enquiry_id !== row.id);
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
            imageInsertCount += 1;
            if (options.failImageInsertAt === imageInsertCount) {
              return Promise.resolve({ error: { message: 'simulated insert failure' } });
            }
            state.enquiryImages.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === 'enquiry_confirmation_tokens') {
        return {
          select: () => eqChain(state.confirmationTokens),
          insert: (payload: ConfirmationTokenRow) => {
            state.confirmationTokens.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'allocate_enquiry_reference') {
        const businessId = args.p_business_id as string;
        const next = state.counters.get(businessId) ?? 1001;
        state.counters.set(businessId, next + 1);
        return { data: `Q-${next}`, error: null };
      }
      if (fn === 'confirm_pending_enquiry') {
        // Mirrors confirm_pending_enquiry() in
        // supabase/migrations/20260829120300_rls_policies.sql closely
        // enough to prove the TS orchestration calls it correctly and
        // handles its failure modes.
        const enquiryId = args.p_enquiry_id as string;
        const token = args.p_token as string;
        const tokenRow = state.confirmationTokens.find((row) => row.enquiry_id === enquiryId);
        if (!tokenRow) return { data: null, error: { message: 'invalid or already-used confirmation token' } };
        if (tokenRow.token_hash !== hashSecureToken(token)) return { data: null, error: { message: 'invalid confirmation token' } };
        const enquiry = state.enquiries.find((row) => row.id === enquiryId);
        if (!enquiry) return { data: null, error: { message: 'unknown enquiry' } };
        if (enquiry.confirmed_at) return { data: null, error: { message: 'enquiry already confirmed' } };
        enquiry.confirmed_at = new Date().toISOString();
        state.confirmationTokens = state.confirmationTokens.filter((row) => row.enquiry_id !== enquiryId);
        return { data: enquiry, error: null };
      }
      throw new Error(`unexpected rpc: ${fn}`);
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

const PUBLISHED = [{ id: 'biz-1', slug: 'dee-valley-scaffolding', site_status: 'published' }];

test('67 an unpublished business is rejected before anything is persisted', async () => {
  const { client, state } = createFakeClient([{ id: 'biz-1', slug: 'draft-biz', site_status: 'draft' }]);
  await assert.rejects(
    () => startEnquirySubmission(client, baseInput({ businessSlug: 'draft-biz' })),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 404,
  );
  assert.equal(state.enquiries.length, 0);
});

test('68 a zero-photo submission is confirmed immediately and completes with a reference', async () => {
  const { client, state } = createFakeClient(PUBLISHED);
  const result = await startEnquirySubmission(client, baseInput());
  assert.equal(result.status, 'complete');
  if (result.status === 'complete') assert.match(result.reference, /^Q-\d+$/);
  assert.equal(state.enquiries[0].confirmed_at !== null, true);
});

test('113 a photo submission is created PENDING (confirmed_at null) and stays that way until confirmed', async () => {
  const { client, state } = createFakeClient(PUBLISHED);
  const result = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }] }));
  assert.equal(result.status, 'pending-uploads');
  assert.equal(state.enquiries[0].confirmed_at, null);
});

test('69 a submission with photos reserves one upload slot and a confirmation token, and stays pending', async () => {
  const { client, state } = createFakeClient(PUBLISHED);
  const result = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }, { mimeType: 'image/png', size: 2000 }] }));
  assert.equal(result.status, 'pending-uploads');
  if (result.status === 'pending-uploads') {
    assert.equal(result.uploads.length, 2);
    assert.ok(result.confirmationToken.length >= 40);
  }
  assert.equal(state.enquiryImages.length, 2);
  assert.equal(state.confirmationTokens.length, 1);
});

test('114 a partial phase-1 reservation failure deletes the pending enquiry and reports failure, not a reference', async () => {
  const { client, state } = createFakeClient(PUBLISHED, { failImageInsertAt: 2 }); // 2nd of 3 photo slots fails
  await assert.rejects(
    () => startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }, { mimeType: 'image/jpeg', size: 1000 }, { mimeType: 'image/jpeg', size: 1000 }] })),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 500,
  );
  // reference gaps are acceptable (mission section 7) — what matters is nothing is left behind:
  assert.equal(state.enquiries.length, 0);
  assert.equal(state.enquiryImages.length, 0);
  assert.equal(state.confirmationTokens.length, 0);
});

test('70 confirming with the correct token after every photo uploaded reports success', async () => {
  const { client, state } = createFakeClient(PUBLISHED);
  const started = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }] }));
  assert.equal(started.status, 'pending-uploads');
  if (started.status !== 'pending-uploads') return;
  state.uploadedPaths.add(started.uploads[0].path); // simulate the browser's direct upload succeeding

  const result = await confirmEnquirySubmission(client, started.enquiryId, started.confirmationToken);
  assert.equal(result.status, 'complete');
  assert.equal(result.reference, started.reference);
  assert.equal(state.enquiries.find((row) => row.id === started.enquiryId)?.confirmed_at !== null, true);
  assert.equal(state.confirmationTokens.length, 0); // consumed
});

test('115 an incorrect confirmation token is rejected, and nothing is rolled back', async () => {
  const { client, state } = createFakeClient(PUBLISHED);
  const started = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }] }));
  if (started.status !== 'pending-uploads') return assert.fail('expected pending-uploads');
  state.uploadedPaths.add(started.uploads[0].path);

  await assert.rejects(
    () => confirmEnquirySubmission(client, started.enquiryId, 'totally-wrong-token'),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 403,
  );
  // rejecting a bad token must never delete anything — the UUID alone is not authorisation (mission section 6).
  assert.equal(state.enquiries.length, 1);
  assert.equal(state.enquiryImages.length, 1);
});

test('116 an empty confirmation token is rejected the same way', async () => {
  const { client } = createFakeClient(PUBLISHED);
  const started = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }] }));
  if (started.status !== 'pending-uploads') return assert.fail('expected pending-uploads');
  await assert.rejects(
    () => confirmEnquirySubmission(client, started.enquiryId, ''),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 403,
  );
});

test('71 a submission is never reported successful when a required photo failed to persist, and is rolled back', async () => {
  const { client, state } = createFakeClient(PUBLISHED);
  const started = await startEnquirySubmission(
    client,
    baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }, { mimeType: 'image/jpeg', size: 1000 }] }),
  );
  if (started.status !== 'pending-uploads') return assert.fail('expected pending-uploads');
  state.uploadedPaths.add(started.uploads[0].path); // only the first of two photos actually made it

  await assert.rejects(
    () => confirmEnquirySubmission(client, started.enquiryId, started.confirmationToken),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 422,
  );

  // rolled back: the enquiry (and its reserved image/token rows) are gone, and the one object that did upload was cleaned up.
  assert.equal(state.enquiries.length, 0);
  assert.equal(state.enquiryImages.length, 0);
  assert.equal(state.confirmationTokens.length, 0);
  assert.equal(state.uploadedPaths.has(started.uploads[0].path), false);
});

test('72 confirming an unknown enquiry id fails clearly rather than silently succeeding', async () => {
  const { client } = createFakeClient(PUBLISHED);
  await assert.rejects(
    () => confirmEnquirySubmission(client, 'does-not-exist', 'any-token'),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 404,
  );
});

test('117 an already-confirmed enquiry cannot be rolled back or re-confirmed through the confirm endpoint', async () => {
  const { client, state } = createFakeClient(PUBLISHED);
  const started = await startEnquirySubmission(client, baseInput({ photos: [{ mimeType: 'image/jpeg', size: 1000 }] }));
  if (started.status !== 'pending-uploads') return assert.fail('expected pending-uploads');
  state.uploadedPaths.add(started.uploads[0].path);
  await confirmEnquirySubmission(client, started.enquiryId, started.confirmationToken);

  await assert.rejects(
    () => confirmEnquirySubmission(client, started.enquiryId, started.confirmationToken),
    (error: unknown) => error instanceof EnquirySubmissionError && error.status === 409,
  );
  // still there, still confirmed — not deleted by the second call.
  assert.equal(state.enquiries.length, 1);
  assert.equal(state.enquiries[0].confirmed_at !== null, true);
});
