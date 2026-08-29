import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateEnquiryReference, type ReferenceRpcClient } from '../lib/data/reference.ts';

const fakeClient = (data: unknown, error: { message: string } | null = null): ReferenceRpcClient => ({
  rpc: async () => ({ data, error }),
});

test('35 allocate_enquiry_reference wrapper returns a well-formed reference', async () => {
  const reference = await allocateEnquiryReference(fakeClient('Q-1042'), 'business-1');
  assert.equal(reference, 'Q-1042');
});

test('36 a database error from the RPC is surfaced, not swallowed', async () => {
  await assert.rejects(() => allocateEnquiryReference(fakeClient(null, { message: 'unknown business_id' }), 'missing'), /unknown business_id/);
});

test('37 a malformed RPC response is rejected rather than trusted', async () => {
  await assert.rejects(() => allocateEnquiryReference(fakeClient('not-a-reference'), 'business-1'), /unexpected value/);
});

test('38 allocateEnquiryReference forwards the business id to the RPC', async () => {
  let received: string | undefined;
  const client: ReferenceRpcClient = {
    rpc: async (_fn, args) => {
      received = args.p_business_id;
      return { data: 'Q-1001', error: null };
    },
  };
  await allocateEnquiryReference(client, 'business-42');
  assert.equal(received, 'business-42');
});
